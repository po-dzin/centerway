import { describe, expect, it, vi } from "vitest";

import { getSnapshotCourse, snapshotCourses } from "./catalog";

/**
 * The live catalog's DECISION TABLE, tested without a database.
 *
 * `getLiveCourse` is three branches and the middle one is the whole design, so
 * the branches are what is worth pinning. The Supabase client and Next's cache
 * are both mocked: this is a test of the rule, not of the driver.
 */

const readCourse = vi.hoisted(() => vi.fn());

vi.mock("next/cache", () => ({
  // The real one memoises; here it must call through so each case is observed.
  unstable_cache: (fn: () => unknown) => fn,
}));

vi.mock("@/lib/auth/adminClient", () => ({ adminClient: () => ({}) }));

vi.mock("./authoring", () => ({
  courseFromRows: (...args: unknown[]) => readCourse(...args),
}));

describe("getLiveCourse", () => {
  it("serves the snapshot when the database cannot answer", async () => {
    // The case the fallback exists for: the old static import could not fail at
    // request time, and this is what replaces that guarantee.
    vi.resetModules();
    vi.doMock("@/lib/auth/adminClient", () => ({
      adminClient: () => ({
        from: () => ({
          select: () => ({
            eq: () => ({ maybeSingle: async () => ({ data: null, error: { message: "connection refused" } }) }),
          }),
        }),
      }),
    }));
    const { getLiveCourse } = await import("./liveCatalog");
    const course = await getLiveCourse("reset-day");
    expect(course?.slug).toBe("reset-day");
    expect(course?.version).toBe(getSnapshotCourse("reset-day")?.version);
  });

  it("answers nothing for an absent row, even when a snapshot of it exists", async () => {
    // THE INVERSION OF THE OLD RULE (2026-08-29). This used to serve the file,
    // on the reasoning that a course in git and missing from the database is a
    // seeding mistake. It is far more often a delete — and the branch could not
    // tell them apart, so the file overruled the owner and republished a course
    // they had removed. A backup answers when the source CANNOT; it does not
    // answer when the source says "no".
    vi.resetModules();
    vi.doMock("@/lib/auth/adminClient", () => ({
      adminClient: () => ({
        from: () => ({
          select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
        }),
      }),
    }));
    const { getLiveCourse } = await import("./liveCatalog");
    expect(await getLiveCourse("reset-day")).toBeNull();
  });

  it("answers nothing for a slug neither source has", async () => {
    vi.resetModules();
    vi.doMock("@/lib/auth/adminClient", () => ({
      adminClient: () => ({
        from: () => ({
          select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
        }),
      }),
    }));
    const { getLiveCourse } = await import("./liveCatalog");
    expect(await getLiveCourse("no-such-course")).toBeNull();
  });

  it("serves the database copy over the snapshot, drafts included", async () => {
    // Drafts must come through: staff and manual-grant holders preview them,
    // and `server.ts` owns that gate. This is also what makes an unpublish
    // work — the row stays and turns draft.
    const snapshot = getSnapshotCourse("reset-day")!;
    const edited = { ...snapshot, title: "Назва, змінена в білдері", status: "draft" as const, version: 99 };

    vi.resetModules();
    vi.doMock("@/lib/auth/adminClient", () => ({
      adminClient: () => ({
        from: (table: string) => ({
          select: () => ({
            eq:
              table === "lms_courses"
                ? () => ({ maybeSingle: async () => ({ data: { id: "c", slug: "reset-day" }, error: null }) })
                : async () => ({ data: [], error: null }),
            maybeSingle: async () => ({ data: { id: "c", slug: "reset-day" }, error: null }),
          }),
        }),
      }),
    }));
    vi.doMock("./authoring", () => ({ courseFromRows: () => edited }));

    const { getLiveCourse } = await import("./liveCatalog");
    const course = await getLiveCourse("reset-day");
    expect(course?.title).toBe("Назва, змінена в білдері");
    expect(course?.status).toBe("draft");
  });
});

describe("the snapshot itself", () => {
  it("is still a complete, valid set — it is what the fallback falls back to", () => {
    expect(snapshotCourses().length).toBeGreaterThan(0);
  });
});
