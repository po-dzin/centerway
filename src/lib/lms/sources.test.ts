import { describe, expect, it, vi } from "vitest";

import { FakeSupabase } from "@/lib/admin/fakeSupabase";
import { MAX_EXTRACTED_CHARS } from "./sources";

vi.mock("@/lib/auth/adminClient", () => ({ adminClient: vi.fn() }));

async function withDatabase(rows: Record<string, unknown>[] = []) {
  const { adminClient } = await import("@/lib/auth/adminClient");
  const db = new FakeSupabase({ lms_course_sources: rows });
  vi.mocked(adminClient).mockImplementation(() => db as never);
  return { db, module: await import("./sources") };
}

const BASE = { courseId: "course-1", kind: "document", title: "Протокол", uploadedBy: "author-1" } as const;

describe("course sources", () => {
  it("records a document against the course that was granted", async () => {
    const { db, module } = await withDatabase();
    await module.registerCourseSource({ ...BASE, extractedText: "тіло документа" });
    expect(db.tables.lms_course_sources).toHaveLength(1);
    expect(db.tables.lms_course_sources[0].course_id).toBe("course-1");
    expect(db.tables.lms_course_sources[0].uploaded_by).toBe("author-1");
  });

  it("refuses a kind the table's CHECK constraint would refuse, with a code the caller can read", async () => {
    const { module } = await withDatabase();
    await expect(module.registerCourseSource({ ...BASE, kind: "course" })).rejects.toThrow("lms_source_invalid_kind");
  });

  it("refuses an empty title", async () => {
    const { module } = await withDatabase();
    await expect(module.registerCourseSource({ ...BASE, title: "   " })).rejects.toThrow("lms_source_missing_title");
  });

  it("refuses a checksum that is not a sha256", async () => {
    // The column feeds a unique index. A value in another shape would sit there
    // as a duplicate nobody can detect.
    const { module } = await withDatabase();
    await expect(module.registerCourseSource({ ...BASE, checksum: "not-a-hash" })).rejects.toThrow(
      "lms_source_invalid_checksum",
    );
  });

  it("refuses text past the ceiling instead of storing an archive", async () => {
    const { module } = await withDatabase();
    await expect(
      module.registerCourseSource({ ...BASE, extractedText: "я".repeat(MAX_EXTRACTED_CHARS + 1) }),
    ).rejects.toThrow("lms_source_extracted_text_too_long");
  });

  it("never returns a source belonging to another course", async () => {
    // The grant says "this course"; the service is what makes a guessed id from
    // a different course answer nothing at all.
    const { module } = await withDatabase([
      { id: "src-1", course_id: "course-2", kind: "note", title: "чужа", extracted_text: "секрет", created_at: "1", updated_at: "1" },
    ]);
    expect(await module.readCourseSource("course-1", "src-1")).toBeNull();
    expect(await module.listCourseSources("course-1")).toEqual([]);
  });

  it("reports text length in the list without carrying the text", async () => {
    const { module } = await withDatabase([
      { id: "src-1", course_id: "course-1", kind: "document", title: "т", extracted_text: "abcde", created_at: "1", updated_at: "1" },
    ]);
    const [summary] = await module.listCourseSources("course-1");
    expect(summary.extractedChars).toBe(5);
    expect(summary).not.toHaveProperty("extractedText");
  });
});
