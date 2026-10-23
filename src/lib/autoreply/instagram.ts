/**
 * The Instagram side of the auto-reply: who is calling us, what they said, and
 * how we answer.
 *
 * WHAT IS VERIFIED AND WHAT IS NOT (2026-10-22). The envelope below (an
 * `object: "instagram"` payload whose `entry[].changes[]` carry a `comments`
 * field) and the `x-hub-signature-256` check are the documented shape of Meta's
 * webhooks. The two Graph calls follow the "Instagram API with Instagram login"
 * private-reply and comment-reply endpoints as described by Meta and by the
 * tools that use them. Meta's own pages could not be opened from the build
 * environment, so the first run on the real account is the real test: the
 * sender treats any refusal as a recorded failure, never as a crash.
 */

import { createHmac } from "node:crypto";

import { secretsEqual } from "@/lib/auth/secretsEqual";

export type CommentEvent = {
  commentId: string;
  mediaId: string | null;
  text: string;
  fromId: string | null;
  fromUsername: string | null;
  /** Unix seconds of the webhook entry; used to refuse comments older than the reply window. */
  time: number | null;
};

/** `sha256=<hex>` over the raw body, keyed by the app secret — what Meta puts in `x-hub-signature-256`. */
export function signBody(secret: string, rawBody: string): string {
  return `sha256=${createHmac("sha256", secret).update(rawBody).digest("hex")}`;
}

export function verifySignature(secret: string, rawBody: string, header: string | null): boolean {
  if (!header) return false;
  return secretsEqual(header.trim(), signBody(secret, rawBody));
}

type ChangeValue = {
  id?: unknown;
  text?: unknown;
  parent_id?: unknown;
  from?: { id?: unknown; username?: unknown };
  media?: { id?: unknown };
};

/**
 * The top-level comments in a webhook body.
 *
 * Skipped on purpose: replies to a comment (`parent_id`), because answering
 * them would start a conversation under every public reply of ours; and the
 * account's own comments (`from.id` equals the entry's account), which is how
 * our own public reply would otherwise trigger the rule again.
 */
export function parseCommentEvents(payload: unknown): CommentEvent[] {
  if (!payload || typeof payload !== "object") return [];
  const body = payload as { object?: unknown; entry?: unknown };
  if (body.object !== "instagram" || !Array.isArray(body.entry)) return [];

  const events: CommentEvent[] = [];
  for (const entry of body.entry as { id?: unknown; time?: unknown; changes?: unknown }[]) {
    if (!entry || !Array.isArray(entry.changes)) continue;
    const accountId = typeof entry.id === "string" ? entry.id : null;
    const time = typeof entry.time === "number" ? entry.time : null;
    for (const change of entry.changes as { field?: unknown; value?: ChangeValue }[]) {
      if (change?.field !== "comments" || !change.value) continue;
      const value = change.value;
      if (typeof value.id !== "string" || typeof value.text !== "string") continue;
      if (value.parent_id) continue;
      const fromId = typeof value.from?.id === "string" ? value.from.id : null;
      if (fromId && accountId && fromId === accountId) continue;
      events.push({
        commentId: value.id,
        mediaId: typeof value.media?.id === "string" ? value.media.id : null,
        text: value.text,
        fromId,
        fromUsername: typeof value.from?.username === "string" ? value.from.username : null,
        time,
      });
    }
  }
  return events;
}

/** Meta's reply window for a private reply to a comment. */
export const REPLY_WINDOW_SECONDS = 7 * 24 * 60 * 60;

/** A button under a message: a tap that comes back to us, or a link that opens. */
export type MessageButton =
  { kind: "postback"; title: string; payload: string } | { kind: "link"; title: string; url: string };

export type InstagramSender = {
  /** The one private reply Instagram allows per comment. */
  sendPrivateReply(commentId: string, text: string, button?: MessageButton): Promise<void>;
  /** A message to someone who has just tapped a button (inside Instagram's 24-hour window). */
  sendDirect(userId: string, text: string, button?: MessageButton): Promise<void>;
  /** A public reply under the comment. */
  replyPublicly(commentId: string, text: string): Promise<void>;
  /** The short code in a post's link, to match a rule that was given a link. */
  shortcodeOf(mediaId: string): Promise<string | null>;
};

export type PostbackEvent = { senderId: string; payload: string };

/** The button taps in a webhook body (`entry[].messaging[].postback`). */
export function parsePostbackEvents(payload: unknown): PostbackEvent[] {
  if (!payload || typeof payload !== "object") return [];
  const body = payload as { object?: unknown; entry?: unknown };
  if (body.object !== "instagram" || !Array.isArray(body.entry)) return [];
  const events: PostbackEvent[] = [];
  for (const entry of body.entry as { id?: unknown; messaging?: unknown }[]) {
    if (!entry || !Array.isArray(entry.messaging)) continue;
    const accountId = typeof entry.id === "string" ? entry.id : null;
    for (const item of entry.messaging as { sender?: { id?: unknown }; postback?: { payload?: unknown } }[]) {
      const senderId = item?.sender?.id;
      const data = item?.postback?.payload;
      if (typeof senderId !== "string" || typeof data !== "string") continue;
      if (accountId && senderId === accountId) continue;
      events.push({ senderId, payload: data });
    }
  }
  return events;
}

function messageBody(text: string, button?: MessageButton): Record<string, unknown> {
  if (!button) return { text };
  const buttons =
    button.kind === "postback"
      ? [{ type: "postback", title: button.title, payload: button.payload }]
      : [{ type: "web_url", title: button.title, url: button.url }];
  return { attachment: { type: "template", payload: { template_type: "button", text, buttons } } };
}

export class InstagramApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "InstagramApiError";
  }
}

function graphBase(): string {
  const version = process.env.META_GRAPH_API_VERSION || "v23.0";
  return `https://graph.instagram.com/${version}`;
}

async function graphPost(path: string, body: Record<string, unknown>, token: string): Promise<void> {
  const res = await fetch(`${graphBase()}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
  if (res.ok) return;
  throw await apiError(res);
}

async function apiError(res: Response): Promise<InstagramApiError> {
  let detail = "";
  try {
    const json = (await res.json()) as { error?: { message?: string; code?: number } };
    detail = json.error?.message ?? "";
  } catch {
    // The status code alone is the answer.
  }
  return new InstagramApiError(detail || `instagram_http_${res.status}`, res.status);
}

async function graphGet<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`${graphBase()}${path}`, {
    headers: { authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw await apiError(res);
  return (await res.json()) as T;
}

/** The live sender, or null while the access token is not configured. */
export function instagramSenderFromEnv(): InstagramSender | null {
  const token = process.env.INSTAGRAM_ACCESS_TOKEN?.trim();
  if (!token) return null;
  return {
    sendPrivateReply: (commentId, text, button) =>
      graphPost("/me/messages", { recipient: { comment_id: commentId }, message: messageBody(text, button) }, token),
    sendDirect: (userId, text, button) =>
      graphPost("/me/messages", { recipient: { id: userId }, message: messageBody(text, button) }, token),
    shortcodeOf: async (mediaId) => {
      const media = await graphGet<{ shortcode?: unknown }>(`/${encodeURIComponent(mediaId)}?fields=shortcode`, token);
      return typeof media.shortcode === "string" ? media.shortcode : null;
    },
    replyPublicly: (commentId, text) =>
      graphPost(`/${encodeURIComponent(commentId)}/replies`, { message: text }, token),
  };
}
