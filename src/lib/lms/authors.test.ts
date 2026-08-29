import { describe, expect, it, vi } from "vitest";

import { FakeSupabase } from "@/lib/admin/fakeSupabase";

vi.mock("@/lib/auth/adminClient", () => ({ adminClient: vi.fn() }));
vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
  unstable_cache: (fn: (...args: unknown[]) => unknown) => fn,
}));
vi.mock("@/lib/platform/offers", () => ({ listStorefrontCourses: vi.fn(async () => []) }));

async function withDatabase(rows: Record<string, unknown[]> = {}) {
  const { adminClient } = await import("@/lib/auth/adminClient");
  const db = new FakeSupabase({ lms_authors: [], lms_courses: [], ...rows });
  vi.mocked(adminClient).mockImplementation(() => db as never);
  return { db, module: await import("./authors") };
}

describe("isEligibleAuthor", () => {
  it("is false for a learner with no byline and no course", async () => {
    const { module } = await withDatabase();
    expect(await module.isEligibleAuthor("user-1")).toBe(false);
  });

  it("is true for someone who owns a course's edit rights", async () => {
    const { module } = await withDatabase({
      lms_courses: [{ id: "c1", author_id: "user-1", slug: "way21" }],
    });
    expect(await module.isEligibleAuthor("user-1")).toBe(true);
  });

  it("is true for someone who already has a byline, even with no course", async () => {
    const { module } = await withDatabase({
      lms_authors: [{ id: "a1", auth_user_id: "user-1", slug: "someone", name: "Хтось" }],
    });
    expect(await module.isEligibleAuthor("user-1")).toBe(true);
  });
});

describe("upsertAuthorProfile", () => {
  it("refuses a write from someone who is not eligible", async () => {
    const { module } = await withDatabase();
    const result = await module.upsertAuthorProfile("user-1", { name: "Хтось" });
    expect(result).toEqual({ ok: false, error: "not_an_author" });
  });

  it("creates a profile with a slug derived from the name", async () => {
    const { db, module } = await withDatabase({
      lms_courses: [{ id: "c1", author_id: "user-1", slug: "way21" }],
    });
    const result = await module.upsertAuthorProfile("user-1", { name: "Іван Петренко" });
    expect(result.ok).toBe(true);
    expect(db.tables.lms_authors).toHaveLength(1);
    expect(db.tables.lms_authors[0]).toMatchObject({ auth_user_id: "user-1", slug: "ivan-petrenko" });
  });

  it("never lets the request body pick a different auth_user_id", async () => {
    const { db, module } = await withDatabase({
      lms_courses: [{ id: "c1", author_id: "user-1", slug: "way21" }],
    });
    // @ts-expect-error — deliberately smuggling a field the type does not carry.
    await module.upsertAuthorProfile("user-1", { name: "Іван", auth_user_id: "someone-else" });
    expect(db.tables.lms_authors[0].auth_user_id).toBe("user-1");
  });

  it("suffixes the slug on a collision with another author", async () => {
    const { db, module } = await withDatabase({
      lms_courses: [{ id: "c1", author_id: "user-2", slug: "way21" }],
      lms_authors: [{ id: "a1", auth_user_id: "user-1", slug: "ivan-petrenko", name: "Іван Петренко" }],
    });
    const result = await module.upsertAuthorProfile("user-2", { name: "Іван Петренко" });
    expect(result.ok).toBe(true);
    expect(db.tables.lms_authors.find((row) => row.auth_user_id === "user-2")?.slug).toBe("ivan-petrenko-2");
  });

  it("updates the caller's own row on a second save rather than creating a second one", async () => {
    const { db, module } = await withDatabase({
      lms_courses: [{ id: "c1", author_id: "user-1", slug: "way21" }],
    });
    await module.upsertAuthorProfile("user-1", { name: "Іван Петренко" });
    await module.upsertAuthorProfile("user-1", { name: "Іван Петренко", bio: "Оновлена біографія." });
    expect(db.tables.lms_authors).toHaveLength(1);
    expect(db.tables.lms_authors[0].bio).toBe("Оновлена біографія.");
  });

  it("rejects a photo without alt text", async () => {
    const { module } = await withDatabase({
      lms_courses: [{ id: "c1", author_id: "user-1", slug: "way21" }],
    });
    const result = await module.upsertAuthorProfile("user-1", {
      name: "Іван",
      // @ts-expect-error — missing `alt` on purpose.
      photo: { src: "https://example.com/x.webp" },
    });
    expect(result).toEqual({ ok: false, error: "invalid_profile" });
  });

  it("stores an author-owned public background separately from the portrait", async () => {
    const { db, module } = await withDatabase({
      lms_courses: [{ id: "c1", author_id: "user-1", slug: "way21" }],
    });
    const result = await module.upsertAuthorProfile("user-1", {
      name: "Іван",
      background: { src: "https://example.com/background.webp" },
    });
    expect(result).toMatchObject({ ok: true, author: { background: { src: "https://example.com/background.webp" } } });
    expect(db.tables.lms_authors[0]).toMatchObject({ background: { src: "https://example.com/background.webp" } });
  });
});

describe("getAuthorProfileForUser", () => {
  it("reports ineligible with no draft for a plain learner", async () => {
    const { module } = await withDatabase();
    expect(await module.getAuthorProfileForUser("user-1")).toEqual({ eligible: false, author: null });
  });

  it("returns the caller's own row even when it is unlisted", async () => {
    const { module } = await withDatabase({
      lms_authors: [{ id: "a1", auth_user_id: "user-1", slug: "ivan", name: "Іван", listed: false }],
    });
    const result = await module.getAuthorProfileForUser("user-1");
    expect(result.eligible).toBe(true);
    expect(result.author).toMatchObject({ slug: "ivan", name: "Іван" });
    expect(result.author?.listed).toBeUndefined();
  });
});
