/**
 * The author of a course opens it without buying it — draft or published — the
 * way staff do. This came from the `coach` role being staff until that role was
 * retired on 2026-10-02; ownership (`lms_courses.author_id`) is now the whole
 * of it (PR #310 review).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { FakeSupabase } from "@/lib/admin/fakeSupabase";
import type { Course } from "@/lms-core";

const db = new FakeSupabase();
vi.mock("@/lib/auth/adminClient", () => ({ adminClient: () => db }));

const { ensureEnrollment, checkEntitlement } = await import("./server");

const course = { id: "c1", slug: "demo", status: "draft", entitlementProductCodes: [] } as unknown as Course;
const who = (authUserId: string) => ({ authUserId, email: `${authUserId}@x.com`, emailVerified: true });
const NOW = new Date("2026-10-03T00:00:00Z");

beforeEach(() => {
  db.tables = {
    lms_enrollments: [],
    lms_courses: [{ id: "c1", author_id: "author" }],
    user_roles: [{ user_id: "author", role: "user" }],
    experience_offers: [{ code: "course:demo", amount: 900, active: true, access_days: null, access_lifetime: true }],
    course_opening_codes: [],
    customers: [],
    orders: [],
  };
});

describe("an author and their own course", () => {
  it("opens it with no purchase and no staff role", async () => {
    const result = await ensureEnrollment(who("author"), course, NOW);
    expect(result.enrollment).not.toBeNull();
    expect(await checkEntitlement(who("author"), course, NOW)).toMatchObject({ entitled: true });
  });

  it("is the only one it opens for: a stranger still has to buy it", async () => {
    const result = await ensureEnrollment(who("stranger"), course, NOW);
    expect(result).toEqual({ enrollment: null, reason: "not_entitled" });
    expect(await checkEntitlement(who("stranger"), course, NOW)).toMatchObject({ entitled: false });
  });
});
