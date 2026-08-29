import { describe, expect, it, vi } from "vitest";

import { adminClient } from "@/lib/auth/adminClient";
import { FakeSupabase } from "@/lib/admin/fakeSupabase";
import { resolveCourseAccess } from "./courseAccess";

/**
 * The access decision, tested where an agent tool will call it — not through a
 * route.
 *
 * That is the whole point of the module: until 2026-08-28 this rule was only
 * reachable by making an HTTP request, so the one caller that will NOT be an
 * HTTP request had nothing to reuse and nothing to test against.
 */

vi.mock("@/lib/auth/adminClient", () => ({ adminClient: vi.fn() }));

const AUTHOR = { id: "author-1", email: "author@example.com" };
const STRANGER = { id: "author-2", email: "stranger@example.com" };
const ADMIN = { id: "admin-1", email: "admin@example.com" };

function database() {
  return new FakeSupabase({
    user_roles: [{ user_id: "admin-1", role: "admin" }],
    lms_courses: [
      { id: "course-1", slug: "way21", author_id: "author-1" },
      { id: "course-2", slug: "house", author_id: null },
    ],
  });
}

/**
 * Imported statically, not through `await import` inside the helper: `vi.mock`
 * is hoisted, so the mock is in place either way — and the dynamic form paid
 * the whole module graph's load cost inside the FIRST test, which turned into a
 * 5s timeout whenever the machine was busy. A flake in an authorization test is
 * worse than a slow one: it trains you to re-run it.
 */
async function accessTo(user: { id: string; email?: string | null } | null, slug: string) {
  vi.mocked(adminClient).mockImplementation(() => database() as never);
  return resolveCourseAccess(user, slug);
}

describe("resolveCourseAccess", () => {
  it("grants the author their own course", async () => {
    const access = await accessTo(AUTHOR, "way21");
    expect("grant" in access && access.grant.courseId).toBe("course-1");
  });

  it("refuses another author with not_found, never with forbidden", async () => {
    // 403 would confirm the course exists. The builder's rule is that whether a
    // course exists is not information an unauthorised caller is owed, and the
    // shared module is where that stays true for tools as well as routes.
    expect(await accessTo(STRANGER, "way21")).toEqual({ denied: "not_found" });
  });

  it("refuses a caller with no session", async () => {
    expect(await accessTo(null, "way21")).toEqual({ denied: "unauthenticated" });
  });

  it("treats a course with no author as house-managed, not as everyone's", async () => {
    expect(await accessTo(AUTHOR, "house")).toEqual({ denied: "not_found" });
    expect("grant" in (await accessTo(ADMIN, "house"))).toBe(true);
  });

  it("answers not_found for a slug that does not exist", async () => {
    expect(await accessTo(ADMIN, "no-such-course")).toEqual({ denied: "not_found" });
  });

  /**
   * The reason access is decided from ownership columns rather than from a
   * rebuilt course: `loadBuilderCourse` validates, so a stored course with a
   * broken block would have answered "no such course" to the one person who
   * can repair it.
   */
  it("grants access to a course whose stored content would fail validation", async () => {
    const access = await accessTo(AUTHOR, "way21");
    expect("grant" in access).toBe(true);
    if (!("grant" in access)) return;
    // The grant exists; the content problem surfaces from load(), separately.
    await expect(access.grant.load()).rejects.toThrow();
  });
});
