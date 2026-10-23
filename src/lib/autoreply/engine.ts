/**
 * One comment in, at most one answer out.
 *
 * The order of the guards is the point of this file. A comment is CLAIMED
 * first (the unique comment id makes Meta's repeated deliveries harmless),
 * then it is refused if it is too old to answer, if this person already has an
 * earlier claim on this rule, or if the hour's cap is spent. Only then does a
 * message leave.
 *
 * The person and cap checks run AFTER the claim and count the claims in flight
 * (pending or sent), so concurrent webhooks see each other: the person's
 * earliest claim wins by (created_at, id), and the cap can undershoot at the
 * boundary but never be overshot. Whatever happens is written to the event row, so the admin journal
 * can say why a comment was not answered.
 */

import { log } from "@/lib/logger";

import { buildLink, DEFAULT_LINK_LABEL, DEFAULT_OPEN_LABEL } from "./link";
import { pickVariant, matchesKeyword } from "./match";

export { buildLink };
import {
  REPLY_WINDOW_SECONDS,
  type CommentEvent,
  type InstagramSender,
  type MessageButton,
  type PostbackEvent,
} from "./instagram";

export type AutoreplyRule = {
  id: string;
  name: string;
  mediaId: string | null;
  keywords: string[];
  publicReplies: string[];
  dmTexts: string[];
  buttonLabel: string | null;
  buttonUrl: string | null;
  utmCampaign: string | null;
  /** Two-step message: the greeting carries a button with this label (default below), the tap brings `followUpText` with the link. */
  openButtonLabel: string | null;
  followUpText: string | null;
  enabled: boolean;
  maxPerHour: number;
};

export type EventStatus = "sent" | "failed" | "skipped_duplicate" | "skipped_old" | "skipped_rate";

export interface AutoreplyStore {
  listEnabledRules(): Promise<AutoreplyRule[]>;
  /** Records the comment as being handled; null when this comment was already handled. */
  claimComment(ruleId: string, event: CommentEvent): Promise<string | null>;
  /** True when this person has an earlier claim (pending or sent) on the rule than this event. */
  hasEarlierClaim(ruleId: string, igUserId: string, eventId: string): Promise<boolean>;
  /** Claims (pending or sent) of the rule since the time, counting the caller's own. */
  countClaimsSince(ruleId: string, sinceIso: string): Promise<number>;
  finish(eventId: string, status: EventStatus, error?: string): Promise<void>;
}

export type HandleResult =
  { outcome: "no_rule" } | { outcome: "already_handled" } | { outcome: EventStatus; ruleId: string };

export type HandleDeps = {
  store: AutoreplyStore;
  sender: InstagramSender | null;
  siteOrigin: string;
  now?: () => number;
  random?: () => number;
};

const POSTBACK_PREFIX = "ar:";

/** The direct message: the chosen text, then the link on its own lines. */
export function composeDirectMessage(text: string, rule: AutoreplyRule, siteOrigin: string): string {
  if (!rule.buttonUrl) return text;
  const link = buildLink(rule.buttonUrl, rule, siteOrigin);
  return `${text}\n\n${rule.buttonLabel ? `${rule.buttonLabel}: ` : ""}${link}`;
}

export async function handleComment(event: CommentEvent, deps: HandleDeps): Promise<HandleResult> {
  const { store, sender, siteOrigin } = deps;
  const now = deps.now ?? Date.now;
  const random = deps.random ?? Math.random;

  const rules = await store.listEnabledRules();
  let rule: AutoreplyRule | undefined;
  for (const candidate of rules) {
    if (!matchesKeyword(event.text, candidate.keywords)) continue;
    if (await watchesPost(candidate, event, sender)) {
      rule = candidate;
      break;
    }
  }
  if (!rule) return { outcome: "no_rule" };

  const eventId = await store.claimComment(rule.id, event);
  if (!eventId) return { outcome: "already_handled" };

  const stop = async (status: EventStatus, error?: string): Promise<HandleResult> => {
    await store.finish(eventId, status, error);
    return { outcome: status, ruleId: rule.id };
  };

  if (event.time !== null && now() / 1000 - event.time > REPLY_WINDOW_SECONDS) return stop("skipped_old");
  if (event.fromId && (await store.hasEarlierClaim(rule.id, event.fromId, eventId))) return stop("skipped_duplicate");
  const sinceIso = new Date(now() - 60 * 60 * 1000).toISOString();
  if ((await store.countClaimsSince(rule.id, sinceIso)) > rule.maxPerHour) return stop("skipped_rate");
  if (!sender) return stop("failed", "instagram_not_configured");

  const text = pickVariant(rule.dmTexts, random);
  if (!text) return stop("failed", "no_dm_text");

  try {
    if (rule.followUpText && rule.buttonUrl) {
      const button: MessageButton = {
        kind: "postback",
        title: rule.openButtonLabel || DEFAULT_OPEN_LABEL,
        payload: `${POSTBACK_PREFIX}${rule.id}`,
      };
      await sender.sendPrivateReply(event.commentId, text, button);
    } else {
      await sender.sendPrivateReply(event.commentId, composeDirectMessage(text, rule, siteOrigin));
    }
  } catch (error) {
    return stop("failed", error instanceof Error ? error.message.slice(0, 300) : "send_failed");
  }

  // The public line is a courtesy: the message has already left, so a refusal
  // here is logged and does not turn a delivered reply into a failed one.
  const publicText = pickVariant(rule.publicReplies, random);
  if (publicText) {
    try {
      await sender.replyPublicly(event.commentId, publicText);
    } catch (error) {
      log.warn("autoreply.public_reply_failed", {
        ruleId: rule.id,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return stop("sent");
}

/**
 * True when the rule watches the post this comment is under. A rule given a
 * post link stores the link's short code, which is compared with the post's own
 * (one Graph call per comment; a failed call means "not this post").
 */
async function watchesPost(rule: AutoreplyRule, event: CommentEvent, sender: InstagramSender | null): Promise<boolean> {
  if (rule.mediaId === null || rule.mediaId === event.mediaId) return true;
  if (!sender || !event.mediaId || /^\d+$/.test(rule.mediaId)) return false;
  try {
    return (await sender.shortcodeOf(event.mediaId)) === rule.mediaId;
  } catch (error) {
    log.warn("autoreply.shortcode_failed", { message: error instanceof Error ? error.message : String(error) });
    return false;
  }
}

/**
 * The second step: the person tapped the greeting's button, so the link goes to
 * them (inside Instagram's 24-hour window for a person who just wrote to us).
 */
export async function handlePostback(
  event: PostbackEvent,
  deps: Pick<HandleDeps, "store" | "sender" | "siteOrigin">,
): Promise<{ outcome: "ignored" | "sent" | "failed" }> {
  if (!event.payload.startsWith(POSTBACK_PREFIX)) return { outcome: "ignored" };
  const ruleId = event.payload.slice(POSTBACK_PREFIX.length);
  const rules = await deps.store.listEnabledRules();
  const rule = rules.find((candidate) => candidate.id === ruleId);
  if (!rule || !rule.followUpText || !rule.buttonUrl || !deps.sender) return { outcome: "ignored" };
  try {
    await deps.sender.sendDirect(event.senderId, rule.followUpText, {
      kind: "link",
      title: rule.buttonLabel || DEFAULT_LINK_LABEL,
      url: buildLink(rule.buttonUrl, rule, deps.siteOrigin),
    });
  } catch (error) {
    log.warn("autoreply.follow_up_failed", {
      ruleId: rule.id,
      message: error instanceof Error ? error.message : String(error),
    });
    return { outcome: "failed" };
  }
  return { outcome: "sent" };
}
