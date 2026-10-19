/**
 * POST /api/feed/:id/share against an in-memory database: who may count a
 * share, how often, and what a refusal looks like. The pure rule (one per
 * account) is in `src/lib/feed/server.test.ts`; this is the handler around it.
 */

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { FakeSupabase } from "@/lib/admin/fakeSupabase";
import { addComment, createFeedPost, feedAuthorForUser, type Db } from "@/lib/feed/server";

const AUTHOR_USER = "00000000-0000-4000-8000-0000000000a1";
const READER = "00000000-0000-4000-8000-0000000000b1";

let db: FakeSupabase;
let signedIn: string | null = READER;
let limited = false;

vi.mock("@/lib/auth/adminClient", () => ({ adminClient: () => db }));
vi.mock("@/lib/auth/requireUser", () => ({
  requireUserFromBearer: async (header: string | null) => (header && signedIn ? { id: signedIn } : null),
}));
vi.mock("@/lib/api/rateLimit", () => ({
  enforceRateLimit: async () => (limited ? { allowed: false, retryAfter: 30 } : { allowed: true }),
  tooManyRequests: () => new Response(JSON.stringify({ error: "rate_limited" }), { status: 429 }),
}));

const { POST } = await import("./route");

let postId = "";
let commentId = "";

beforeEach(async () => {
  signedIn = READER;
  limited = false;
  db = new FakeSupabase({
    lms_authors: [
      {
        id: "author-evg",
        slug: "evgeniy",
        name: "Євгеній",
        photo: null,
        listed: true,
        auth_user_id: AUTHOR_USER,
      },
    ],
  });
  db.nextId = () => crypto.randomUUID();
  const author = await feedAuthorForUser(db as unknown as Db, AUTHOR_USER);
  const { post } = await createFeedPost(db as unknown as Db, author!, {
    body: "Три хвилини дихання",
    topic: "breathing",
  });
  postId = post.id;
  commentId = (await addComment(db as unknown as Db, postId, READER, { body: "Дякую" })).comment.id;
});

function react(emoji = "heart", headers: Record<string, string> = { authorization: "Bearer t" }, id = commentId) {
  return POST(
    new NextRequest(`http://localhost/api/feed/comments/${id}/reactions`, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify({ emoji }),
    }),
    { params: Promise.resolve({ id }) },
  );
}
describe("comment reaction HTTP boundary", () => {
  it("requires an account", async () => {
    expect((await react("heart", {})).status).toBe(401);
  });
  it("enforces the write limiter", async () => {
    limited = true;
    expect((await react()).status).toBe(429);
  });
  it("persists a reaction and returns its counts", async () => {
    const response = await react();
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ reactions: [{ emoji: "heart", count: 1, mine: true }] });
    expect(db.tables.feed_comment_reactions).toHaveLength(1);
  });
  it("rejects arbitrary emoji", async () => {
    expect((await react("bad-code")).status).toBe(422);
  });
  it("does not write to an absent comment", async () => {
    expect((await react("heart", undefined, "00000000-0000-4000-8000-00000000dead")).status).toBe(404);
  });
});
