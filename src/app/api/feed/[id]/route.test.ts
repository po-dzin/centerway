/**
 * /api/feed/:id — who may remove or pin a post. The platform's posts (the
 * pinned introduction among them) belong to admins; any other post to the
 * author who wrote it. The rules are in `src/lib/feed/server.ts`; this is the
 * handler that decides who is asking.
 */

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { FakeSupabase } from "@/lib/admin/fakeSupabase";
import { createFeedPost, feedAuthorForUser, feedPlatformAuthor, type Db } from "@/lib/feed/server";

const AUTHOR_USER = "00000000-0000-4000-8000-0000000000a1";
const ADMIN = "00000000-0000-4000-8000-0000000000aa";
const READER = "00000000-0000-4000-8000-0000000000b1";

let db: FakeSupabase;
let signedIn: string | null = READER;

vi.mock("@/lib/auth/adminClient", () => ({ adminClient: () => db }));
vi.mock("@/lib/auth/requireUser", () => ({
  requireUserFromBearer: async (header: string | null) => (header && signedIn ? { id: signedIn } : null),
}));
vi.mock("@/lib/api/rateLimit", () => ({
  enforceRateLimit: async () => ({ allowed: true }),
  tooManyRequests: () => new Response("{}", { status: 429 }),
}));

const { DELETE, PATCH } = await import("./route");

let ownPost = "";
let platformPost = "";

beforeEach(async () => {
  signedIn = READER;
  db = new FakeSupabase({
    lms_authors: [
      { id: "author-evg", slug: "evgeniy", name: "Євгеній", photo: null, listed: true, auth_user_id: AUTHOR_USER },
      { id: "author-platform", slug: "centerway", name: "CenterWay", photo: null, listed: false, auth_user_id: null },
    ],
    user_roles: [{ user_id: ADMIN, role: "admin" }],
  });
  db.nextId = () => crypto.randomUUID();
  const handle = db as unknown as Db;
  ownPost = (
    await createFeedPost(handle, (await feedAuthorForUser(handle, AUTHOR_USER))!, {
      body: "Мій допис",
      topic: "focus",
    })
  ).post.id;
  platformPost = (
    await createFeedPost(
      handle,
      (await feedPlatformAuthor(handle, ADMIN))!,
      { body: "Вступ", topic: "focus" },
      new Date(),
      { platform: true, pinned: true },
    )
  ).post.id;
});

const posts = () => (db.tables["feed_posts"] ?? []) as { id: string; pinned_at: string | null }[];

function call(
  method: "DELETE" | "PATCH",
  id: string,
  body?: unknown,
  headers: Record<string, string> = { authorization: "Bearer t" },
) {
  const req = new NextRequest(`http://localhost/api/feed/${id}`, {
    method,
    headers: { "content-type": "application/json", ...headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return (method === "DELETE" ? DELETE : PATCH)(req, { params: Promise.resolve({ id }) });
}

describe("DELETE /api/feed/:id", () => {
  it("answers 401 to a guest", async () => {
    expect((await call("DELETE", ownPost, undefined, {})).status).toBe(401);
    expect(posts()).toHaveLength(2);
  });

  it("lets the author remove their own post and nobody else's", async () => {
    signedIn = READER;
    expect((await call("DELETE", ownPost)).status).toBe(200);
    expect(posts().some((post) => post.id === ownPost)).toBe(true);
    signedIn = AUTHOR_USER;
    await call("DELETE", ownPost);
    expect(posts().some((post) => post.id === ownPost)).toBe(false);
    await call("DELETE", platformPost);
    expect(posts().some((post) => post.id === platformPost)).toBe(true);
  });

  it("lets an admin remove the platform's post, the pinned one included", async () => {
    signedIn = ADMIN;
    await call("DELETE", platformPost);
    expect(posts().some((post) => post.id === platformPost)).toBe(false);
  });
});

describe("PATCH /api/feed/:id as the platform", () => {
  it("is refused to a reader who is not an admin", async () => {
    const res = await call("PATCH", platformPost, { asPlatform: true, pinOnly: true, pinned: false });
    expect(res.status).toBe(403);
    expect(posts().find((post) => post.id === platformPost)?.pinned_at).toBeTruthy();
  });

  it("lets an admin unpin without touching the words", async () => {
    signedIn = ADMIN;
    const res = await call("PATCH", platformPost, { asPlatform: true, pinOnly: true, pinned: false });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ post: { pinned: false, body: "Вступ" } });
  });
});
