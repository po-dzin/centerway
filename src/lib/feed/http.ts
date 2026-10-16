/**
 * The feed's routes share three things: who is asking (optional for reads,
 * required for writes), how a refusal is said, and the write limits.
 * Server-only.
 */

import type { NextRequest } from "next/server";

import { fail } from "@/lib/api/route";
import { enforceRateLimit, tooManyRequests, type RateLimitRule } from "@/lib/api/rateLimit";
import { adminClient } from "@/lib/auth/adminClient";
import { requireUserFromBearer } from "@/lib/auth/requireUser";

import { FeedError, feedAuthorForUser, type Db } from "./server";

/** Reactions, comments, marks: a person at a keyboard, with headroom. */
export const FEED_READER_WRITE: RateLimitRule = { name: "feed_reader_write", limit: 60, windowSeconds: 60 };
/** Posts: an author writes a few a day; thirty an hour is not writing. */
export const FEED_POST_WRITE: RateLimitRule = { name: "feed_post_write", limit: 30, windowSeconds: 3600 };

export function feedDb(): Db {
  return adminClient();
}

/** The signed-in account, or null for a guest. Never a failure on its own. */
export async function viewerOf(req: NextRequest): Promise<{ id: string } | null> {
  const header = req.headers.get("authorization");
  if (!header) return null;
  const user = await requireUserFromBearer(header);
  return user ? { id: user.id } : null;
}

type Guarded<T> = { ok: true; value: T } | { ok: false; response: Response };

/** A signed-in account within the write limit. */
export async function writer(req: NextRequest, rule: RateLimitRule): Promise<Guarded<{ id: string }>> {
  const user = await viewerOf(req);
  if (!user) return { ok: false, response: fail(401, "unauthorized") };
  const limit = await enforceRateLimit(req, rule, user.id);
  if (!limit.allowed) return { ok: false, response: tooManyRequests(limit.retryAfter) };
  return { ok: true, value: user };
}

/** A signed-in listed author within the post limit. */
export async function authorWriter(req: NextRequest, db: Db) {
  const user = await writer(req, FEED_POST_WRITE);
  if (!user.ok) return user;
  const author = await feedAuthorForUser(db, user.value.id);
  if (!author) return { ok: false as const, response: fail(403, "not_an_author") };
  return { ok: true as const, value: author };
}

/** A `FeedError` is a refusal with its own status; anything else is rethrown for `withRoute`. */
export function refusal(error: unknown): Response {
  if (error instanceof FeedError) return fail(error.status, error.code);
  throw error;
}

export async function jsonBody(req: NextRequest): Promise<Record<string, unknown>> {
  try {
    const body = (await req.json()) as unknown;
    return body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
