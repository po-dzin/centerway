/**
 * GET/PUT /api/platform/users/me/sphere-map against an in-memory database:
 * only the caller's own row is read or written, a bad body writes nothing, and
 * a change of A leaves a snapshot behind. The validation itself is covered in
 * `src/lib/profile/sphereMap.test.ts`; this is the handler around it.
 */

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { FakeSupabase } from "@/lib/admin/fakeSupabase";
import { EMPTY_CYCLE, EMPTY_RHYTHM } from "@/lib/profile/cycle";

const OWNER = "00000000-0000-4000-8000-0000000000a1";
const OTHER = "00000000-0000-4000-8000-0000000000b1";

let db: FakeSupabase;
let signedIn: string | null = OWNER;

vi.mock("@/lib/auth/adminClient", () => ({ adminClient: () => db }));
vi.mock("@/lib/auth/requireUser", () => ({
  requireUserFromBearer: async (header: string | null) => (header && signedIn ? { id: signedIn } : null),
}));

const { GET, PUT } = await import("./route");

beforeEach(() => {
  signedIn = OWNER;
  db = new FakeSupabase({
    profile_sphere_maps: [
      {
        auth_user_id: OTHER,
        spheres: { body: { now: 9, goal: 10 } },
        focus: ["body"],
        history: [{ at: "2026-10-01T10:00:00.000Z", now: { body: 9 } }],
      },
    ],
  });
});

const rows = () => db.tables["profile_sphere_maps"] ?? [];
const ownRow = () => rows().find((row) => row.auth_user_id === OWNER);

function get(headers: Record<string, string> = { authorization: "Bearer t" }) {
  return GET(new NextRequest("http://localhost/api/platform/users/me/sphere-map", { headers }));
}

function put(body: unknown, headers: Record<string, string> = { authorization: "Bearer t" }) {
  return PUT(
    new NextRequest("http://localhost/api/platform/users/me/sphere-map", {
      method: "PUT",
      headers: { "content-type": "application/json", ...headers },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
}

describe("GET /api/platform/users/me/sphere-map", () => {
  it("answers 401 to a guest", async () => {
    expect((await get({})).status).toBe(401);
  });

  it("gives an empty map to a person who has none, not somebody else's", async () => {
    const res = await get();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      map: { spheres: {}, focus: [], history: [], updatedAt: null, cycle: EMPTY_CYCLE, rhythm: EMPTY_RHYTHM },
    });
  });
});

describe("PUT /api/platform/users/me/sphere-map", () => {
  it("answers 401 to a guest and writes nothing", async () => {
    const res = await put({ spheres: { body: { now: 3, goal: 6 } } }, {});
    expect(res.status).toBe(401);
    expect(rows()).toHaveLength(1);
  });

  it("refuses malformed JSON", async () => {
    const res = await put("{nope");
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_json" });
  });

  it("refuses an invalid body with its code and writes nothing", async () => {
    const res = await put({ spheres: { body: { now: 12 } } });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_score" });
    expect(ownRow()).toBeUndefined();
  });

  it("saves the caller's map under their own id and records a snapshot", async () => {
    const res = await put({ spheres: { body: { now: 3, goal: 7, note: "сплю по 6 годин" } }, focus: ["body"] });
    expect(res.status).toBe(200);
    const { map } = await res.json();
    expect(map.spheres).toEqual({ body: { now: 3, goal: 7, note: "сплю по 6 годин" } });
    expect(map.focus).toEqual(["body"]);
    expect(map.history).toHaveLength(1);
    expect(map.history[0].now).toEqual({ body: 3 });

    // The other account's row is untouched.
    expect(rows().find((row) => row.auth_user_id === OTHER)?.spheres).toEqual({ body: { now: 9, goal: 10 } });

    const again = await (await get()).json();
    expect(again.map.spheres.body.now).toBe(3);
  });

  it("does not add a snapshot when only B changed", async () => {
    await put({ spheres: { body: { now: 3, goal: 7 } } });
    const res = await put({ spheres: { body: { now: 3, goal: 9 } } });
    const { map } = await res.json();
    expect(map.spheres.body.goal).toBe(9);
    expect(map.history).toHaveLength(1);
  });

  it("answers 500 when the database fails", async () => {
    db.failures["profile_sphere_maps:insert"] = "boom";
    const res = await put({ spheres: { body: { now: 3, goal: 7 } } });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "save_failed" });
  });
});
