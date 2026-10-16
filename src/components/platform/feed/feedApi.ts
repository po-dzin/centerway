"use client";

/**
 * The feed's calls from the browser. Every call goes with the session's token
 * when there is one (`authorizedFetch`), so a signed-in reader's own reactions
 * come back marked; a guest's reads go without one and still work.
 *
 * A failure is a code, never a throw: the card that asked decides what to say.
 */

import { authorizedFetch } from "@/components/auth/authorizedFetch";
import { feedFilterQuery, type FeedFilter, type ReactionCount } from "@/lib/feed/model";
import type { ComposerCourse, FeedAuthor, FeedComment, FeedPage, FeedPost } from "@/lib/feed/server";

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
  posts: FeedPost[];
  courses: ComposerCourse[];
};

export function fetchFeedMe() {
  return call<FeedMe>("/api/feed/me");
}

export type NewPost = {
  body: string;
  topic: string;
  courseId?: string | null;
  lessonId?: string | null;
  blockId?: string | null;
  blockDisplay?: "full" | "excerpt";
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

export function deletePost(id: string) {
  return call<{ ok: true }>(`/api/feed/${id}`, { method: "DELETE" });
}

export function toggleReaction(postId: string, emoji: string) {
  return call<{ reactions: ReactionCount[] }>(`/api/feed/${postId}/reactions`, json({ emoji }));
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
