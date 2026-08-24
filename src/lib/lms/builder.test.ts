import { describe, expect, it, vi } from "vitest";

/**
 * Only `deleteBuilderCourse`'s refusal order is under test here — the rest of
 * `builder.ts` reads and writes the database directly through `adminClient()`
 * and has no fixture layer of its own yet. A mock client is built for exactly
 * the one query path this test needs, so a call the function is not supposed
 * to reach (enrollments, progress) throws instead of silently answering "none".
 */
function mockAdminClientReturning(courseRow: Record<string, unknown> | null) {
  return () => ({
    from(table: string) {
      if (table === "lms_courses") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: courseRow, error: null }),
            }),
          }),
        };
      }
      throw new Error(`unexpected query against ${table} — the snapshot refusal should have short-circuited first`);
    },
  });
}

vi.mock("@/lib/auth/adminClient", () => ({
  adminClient: vi.fn(),
}));

describe("deleteBuilderCourse", () => {
  it("refuses a snapshot-backed course before checking enrollments", async () => {
    const { adminClient } = await import("@/lib/auth/adminClient");
    const { deleteBuilderCourse } = await import("./builder");

    vi.mocked(adminClient).mockImplementation(
      mockAdminClientReturning({ id: "row-1", status: "draft" }) as never,
    );

    // "way21" ships as data/courses/way21.json — a snapshot exists for it
    // regardless of what the database row says.
    await expect(deleteBuilderCourse("way21")).rejects.toThrow("lms_builder_delete_has_snapshot:way21");
  });
});

describe("nextDraftTitle", () => {
  it("starts with the plain default and advances beyond gaps without colliding", async () => {
    const { nextDraftTitle } = await import("./builder");
    expect(nextDraftTitle([])).toBe("Новий курс");
    expect(nextDraftTitle(["Новий курс", "Новий курс 2", "Новий курс 4", "Інший курс"])).toBe("Новий курс 5");
  });

  it("matches the default case-insensitively", async () => {
    const { nextDraftTitle } = await import("./builder");
    expect(nextDraftTitle(["новий курс", "НОВИЙ КУРС 2"])).toBe("Новий курс 3");
  });
});

describe("courseSlugCanChange", () => {
  it("allows only an unused hidden draft outside shipped snapshots", async () => {
    const { courseSlugCanChange } = await import("./builder");
    expect(courseSlugCanChange({
      course: { slug: "new-course-k7m4", status: "draft", visibility: "hidden" },
      reviewStatus: "draft",
    })).toBe(true);
    expect(courseSlugCanChange({
      course: { slug: "new-course-k7m4", status: "published", visibility: "hidden" },
      reviewStatus: "approved",
    })).toBe(false);
    expect(courseSlugCanChange({
      course: { slug: "way21", status: "draft", visibility: "hidden" },
      reviewStatus: "draft",
    })).toBe(false);
  });
});

describe("isDraftGeneration", () => {
  it("accepts only non-negative safe integer compare-and-swap tokens", async () => {
    const { isDraftGeneration } = await import("./builder");
    expect(isDraftGeneration(0)).toBe(true);
    expect(isDraftGeneration(42)).toBe(true);
    expect(isDraftGeneration(-1)).toBe(false);
    expect(isDraftGeneration(1.5)).toBe(false);
    expect(isDraftGeneration(Number.MAX_SAFE_INTEGER + 1)).toBe(false);
    expect(isDraftGeneration("4")).toBe(false);
  });
});

describe("writeRequiresPublishApproval", () => {
  it("allows an already-published course to be saved as a pending revision", async () => {
    const { writeRequiresPublishApproval } = await import("./builder");
    expect(writeRequiresPublishApproval({
      liveStatus: "published",
      incomingStatus: "published",
      reviewStatus: "draft",
    })).toBe(false);
  });

  it("still gates a draft becoming the live release", async () => {
    const { writeRequiresPublishApproval } = await import("./builder");
    expect(writeRequiresPublishApproval({
      liveStatus: "draft",
      incomingStatus: "published",
      reviewStatus: "draft",
    })).toBe(true);
    expect(writeRequiresPublishApproval({
      liveStatus: "draft",
      incomingStatus: "published",
      reviewStatus: "approved",
    })).toBe(false);
  });
});
