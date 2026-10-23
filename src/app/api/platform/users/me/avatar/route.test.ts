/**
 * POST /api/platform/users/me/avatar against an in-memory database: a guest is
 * refused, a learner's face lands on the account, and an author's lands in the
 * author profile first so the cabinet's re-sync cannot undo it. The bytes'
 * own path is covered in `src/lib/media/profileImage.test.ts`; here it is
 * stood in for.
 */

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { FakeSupabase } from "@/lib/admin/fakeSupabase";

const OWNER = "00000000-0000-4000-8000-0000000000a1";

let db: FakeSupabase;
let signedIn: string | null = OWNER;
const storeProfileImage = vi.fn();

vi.mock("@/lib/auth/adminClient", () => ({ adminClient: () => db }));
vi.mock("@/lib/auth/requireUser", () => ({
  requireUserFromBearer: async (header: string | null) => (header && signedIn ? { id: signedIn } : null),
}));
vi.mock("@/lib/api/rateLimit", () => ({
  enforceRateLimit: async () => ({ allowed: true }),
  tooManyRequests: () => new Response(null, { status: 429 }),
}));
vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
  unstable_cache: (fn: (...args: unknown[]) => unknown) => fn,
}));
vi.mock("@/lib/platform/offers", () => ({ listStorefrontCourses: vi.fn(async () => []) }));
vi.mock("@/lib/media/profileImage", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/media/profileImage")>()),
  storeProfileImage: (...args: unknown[]) => storeProfileImage(...args),
}));

const { POST } = await import("./route");

const NEW_SRC = "https://cdn/course-media/x/1600.webp";

beforeEach(() => {
  signedIn = OWNER;
  db = new FakeSupabase({ lms_authors: [], lms_courses: [] });
  storeProfileImage.mockReset();
  storeProfileImage.mockImplementation(async (_db: unknown, input: { prefix: string }) => ({
    ok: true,
    src: NEW_SRC,
    path: `${input.prefix}/id/1600.webp`,
    width: 800,
    height: 800,
    bytes: 1,
    sourceBytes: 1,
  }));
});

function post(file: File | null, headers: Record<string, string> = { authorization: "Bearer t" }) {
  const form = new FormData();
  if (file) form.append("file", file);
  return POST(
    new NextRequest("http://localhost/api/platform/users/me/avatar", { method: "POST", headers, body: form }),
  );
}

const photo = () => new File([new Uint8Array([1, 2, 3])], "face.jpg", { type: "image/jpeg" });
const account = () => db.authUsers.find((user) => user.id === OWNER)?.metadata;

describe("POST /api/platform/users/me/avatar", () => {
  it("answers 401 to a guest and stores nothing", async () => {
    signedIn = null;
    expect((await post(photo(), {})).status).toBe(401);
    expect(storeProfileImage).not.toHaveBeenCalled();
  });

  it("refuses a file that is not a picture", async () => {
    const res = await post(new File(["x"], "a.txt", { type: "text/plain" }));
    expect(res.status).toBe(415);
    expect(storeProfileImage).not.toHaveBeenCalled();
  });

  it("puts a learner's face on the account, under accounts/", async () => {
    const res = await post(photo());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ src: NEW_SRC, author: null });
    expect(storeProfileImage.mock.calls[0]![1]).toMatchObject({ prefix: `accounts/${OWNER}`, uploadedBy: OWNER });
    expect(account()).toEqual({ cw_avatar: NEW_SRC });
  });

  it("puts an author's face into the profile and the account follows it", async () => {
    db.tables.lms_authors!.push({
      id: "a1",
      auth_user_id: OWNER,
      slug: "tsentr",
      name: "Центр П.",
      photo: { src: "https://cdn/old.webp", alt: "Центр П. біля вікна", avatarCropX: 40 },
    });
    const res = await post(photo());
    expect(res.status).toBe(200);
    const body = (await res.json()) as { src: string; author: { photo: Record<string, unknown> } };
    expect(storeProfileImage.mock.calls[0]![1]).toMatchObject({ prefix: `authors/${OWNER}` });
    expect(body.author.photo).toEqual({ src: NEW_SRC, alt: "Центр П. біля вікна", avatarCropX: 40 });
    expect(db.tables.lms_authors![0]!.photo).toMatchObject({ src: NEW_SRC });
    expect(account()).toEqual({ cw_name: "Центр П.", cw_avatar: NEW_SRC, cw_avatar_crop: { x: 40 } });
  });

  it("passes a storage failure through and writes nothing", async () => {
    storeProfileImage.mockResolvedValueOnce({ ok: false, error: "media_upload_failed:boom", status: 502 });
    const res = await post(photo());
    expect(res.status).toBe(502);
    expect(account()).toBeUndefined();
  });
});
