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
