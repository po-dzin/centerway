"use client";

/**
 * The feed's calls from the browser. Every call goes with the session's token
 * when there is one (`authorizedFetch`), so a signed-in reader's own reactions
 * come back marked; a guest's reads go without one and still work.
 *
 * A failure is a code, never a throw: the card that asked decides what to say.
 */

import { authorizedFetch } from "@/components/auth/authorizedFetch";
import type { FeedMediaStored } from "@/lib/feed/media";
import { feedFilterQuery, type FeedFilter, type FeedTopic, type ReactionCount } from "@/lib/feed/model";
import type { ComposerCourse, FeedAuthor, FeedComment, FeedPage, FeedPost } from "@/lib/feed/server";
import type { UploadedMedia } from "@/lib/feed/upload";

export type FeedResult<T> = { ok: true; data: T } | { ok: false; code: string; status: number };

async function call<T>(input: string, init: RequestInit = {}): Promise<FeedResult<T>> {
  try {
    const response = await authorizedFetch(input, init);
    const payload = (await response.json().catch(() => ({}))) as T & { error?: string };
    if (!response.ok) return { ok: false, code: String(payload?.error ?? response.status), status: response.status };
    return { ok: true, data: payload };
  } catch {
    return { ok: false, code: "network", status: 0 };
  }
}

const json = (body: unknown): RequestInit => ({ method: "POST", body: JSON.stringify(body) });

export function fetchFeedPage(filter: FeedFilter, options: { before?: string | null } = {}) {
  const parts = [feedFilterQuery(filter)];
  if (options.before) parts.push(`before=${encodeURIComponent(options.before)}`);
  const query = parts.filter(Boolean).join("&");
  return call<FeedPage>(`/api/feed${query ? `?${query}` : ""}`);
}

export function fetchFeedPost(id: string) {
  return call<{ post: FeedPost }>(`/api/feed/${id}`);
}

export type FeedMe = {
  author: FeedAuthor | null;
  /** An admin's second voice, the platform's own byline; null for everyone else. */
  platform: FeedAuthor | null;
  posts: FeedPost[];
  courses: ComposerCourse[];
  /** Every other listed author — the composer's «з …» menu. Empty for a reader. */
  taggable: FeedAuthor[];
};

export function fetchFeedMe() {
  return call<FeedMe>("/api/feed/me");
}

export type NewPost = {
  /** The markdown subset of `@/lib/feed/format`; ≤ 4000 visible characters. */
  body: string;
  /** One to three, the first is the main one. */
  topics?: FeedTopic[];
  /** The old single topic; still accepted when `topics` is absent. */
  topic?: string | null;
  /** Paths from `uploadFeedMedia`; `video.youtubeId` may be a pasted link. */
  media?: FeedMediaStored | null;
  /** Listed author ids from `FeedMe.taggable`, at most three. */
  taggedAuthorIds?: string[];
  courseId?: string | null;
  lessonId?: string | null;
  blockId?: string | null;
  blockDisplay?: "full" | "excerpt";
  /** An admin writing as CenterWay; the post is published at once. */
  asPlatform?: boolean;
  /** With `asPlatform`: make it the pinned post of the feed. */
  pinned?: boolean;
};

export type PostFinding = { rule: string; label: string; detail: string };

export function createPost(input: NewPost) {
  return call<{ post: FeedPost; findings: PostFinding[] }>("/api/feed", json(input));
}

export function resubmitPost(id: string, input: NewPost) {
  return call<{ post: FeedPost; findings: PostFinding[] }>(`/api/feed/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

/** An admin pins or unpins a post of the platform's. */
export function pinPost(id: string, pinned: boolean) {
  return call<{ post: FeedPost }>(`/api/feed/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ asPlatform: true, pinOnly: true, pinned }),
  });
}

export function deletePost(id: string) {
  return call<{ ok: true }>(`/api/feed/${id}`, { method: "DELETE" });
}

/** A fourth different emoji answers `{ ok: false, code: "reaction_limit", status: 409 }`. */
export function toggleReaction(postId: string, emoji: string) {
  return call<{ reactions: ReactionCount[] }>(`/api/feed/${postId}/reactions`, json({ emoji }));
}

/** «Зберегти» → «Мій журнал». */
export function savePost(postId: string) {
  return call<{ saved: true }>(`/api/feed/${postId}/save`, { method: "POST" });
}

export function unsavePost(postId: string) {
  return call<{ saved: false }>(`/api/feed/${postId}/save`, { method: "DELETE" });
}

export type ShareChannel = "link" | "telegram" | "system";

/** A signed-in reader shared the post; `first` is false when they had before. */
export function recordShare(postId: string, channel: ShareChannel) {
  return call<{ first: boolean }>(`/api/feed/${postId}/share`, json({ channel }));
}

/**
 * A photo or an audio for a post (`multipart/form-data`). The answer's `path`
 * goes into `NewPost.media`; `src` is for the composer's thumbnail or player.
 */
export function uploadFeedMedia(file: File | Blob, name = "upload", asPlatform = false) {
  const form = new FormData();
  form.append("file", file instanceof File ? file : new File([file], name, { type: file.type }));
  return call<UploadedMedia>(asPlatform ? "/api/feed/media?as=platform" : "/api/feed/media", {
    method: "POST",
    body: form,
  });
}

export function fetchComments(postId: string) {
  return call<{ comments: FeedComment[] }>(`/api/feed/${postId}/comments`);
}

export function addComment(postId: string, body: string, parentId: string | null) {
  return call<{ comment: FeedComment; held: boolean }>(`/api/feed/${postId}/comments`, json({ body, parentId }));
}

export function removeComment(commentId: string) {
  return call<{ ok: true }>(`/api/feed/comments/${commentId}`, { method: "DELETE" });
}

export type FeedMarkView = {
  clientId: string;
  postId: string;
  quote: string | null;
  start: number | null;
  end: number | null;
  note: string | null;
};

export function fetchMarks(postIds: string[]) {
  return call<{ marks: FeedMarkView[] }>(`/api/feed/marks?post=${postIds.map(encodeURIComponent).join(",")}`);
}

export function saveMark(mark: FeedMarkView & { prefix?: string | null }) {
  return call<{ mark: FeedMarkView }>("/api/feed/marks", json(mark));
}

export function deleteMark(clientId: string) {
  return call<{ ok: true }>(`/api/feed/marks/${encodeURIComponent(clientId)}`, { method: "DELETE" });
}
