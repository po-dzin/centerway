/**
 * POST /api/feed/:id/share against an in-memory database: who may count a
 * share, how often, and what a refusal looks like. The pure rule (one per
 * account) is in `src/lib/feed/server.test.ts`; this is the handler around it.
 */

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { FakeSupabase } from "@/lib/admin/fakeSupabase";
import { createFeedPost, feedAuthorForUser, type Db } from "@/lib/feed/server";

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
});

const shares = () => db.tables["feed_shares"] ?? [];

function share(body: unknown, headers: Record<string, string> = { authorization: "Bearer t" }, id = postId) {
  const req = new NextRequest(`http://localhost/api/feed/${id}/share`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  return POST(req, { params: Promise.resolve({ id }) });
}

describe("POST /api/feed/:id/share", () => {
  it("answers 401 to a guest and writes nothing", async () => {
    const res = await share({ channel: "link" }, {});
    expect(res.status).toBe(401);
    expect(shares()).toHaveLength(0);
  });

  it("answers 429 over the write limit", async () => {
    limited = true;
    expect((await share({ channel: "link" })).status).toBe(429);
    expect(shares()).toHaveLength(0);
  });

  it("counts the first share of an account, and says so only once", async () => {
    const first = await share({ channel: "telegram" });
    expect(first.status).toBe(200);
    expect(await first.json()).toMatchObject({ first: true });
    const again = await share({ channel: "link" });
    expect(await again.json()).toMatchObject({ first: false });
    expect(shares()).toHaveLength(1);
  });

  it("refuses an unknown channel with its own code", async () => {
    const res = await share({ channel: "email" });
    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({ error: "share_invalid" });
    expect(shares()).toHaveLength(0);
  });

  it("answers 404 for a post that is not there", async () => {
    const res = await share({ channel: "link" }, undefined, "00000000-0000-4000-8000-00000000dead");
    expect(res.status).toBe(404);
  });
});
