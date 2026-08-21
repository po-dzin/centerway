import { describe, expect, it } from "vitest";

import { writeCourseStructure, type StructureWriter } from "./authoring";
import { getCourse } from "./catalog";

type Row = Record<string, unknown>;

/**
 * A writer that enforces the one rule the real database enforces and a mock
 * usually does not: NOT NULL is checked on the PROPOSED TUPLE, before ON
 * CONFLICT resolves. That is why `upsert([{ id, status, version }])` raised
 * 23502 on `slug` against production while every existing test passed — the
 * fixtures accepted any object.
 */
function fakeWriter(): StructureWriter & { rows: Record<string, Row[]>; log: string[] } {
  const NOT_NULL: Record<string, string[]> = {
    lms_courses: ["id", "slug", "title", "program_slug", "translation_group_id"],
    lms_modules: ["id", "course_id", "slug", "title", "order"],
    lms_lessons: ["id", "course_id", "module_id", "slug", "title", "order"],
  };

  const rows: Record<string, Row[]> = { lms_courses: [], lms_modules: [], lms_lessons: [] };
  const log: string[] = [];

  const writer = {
    rows,
    log,
    from(table: string) {
      return {
        upsert: async (payload: Row[]) => {
          log.push(`upsert ${table} x${payload.length}`);
          for (const row of payload) {
            for (const column of NOT_NULL[table] ?? []) {
              if (row[column] === undefined || row[column] === null) {
                return { error: { message: `null value in column "${column}" of relation "${table}" violates not-null constraint` } };
              }
            }
            const existing = (rows[table] ??= []).find((candidate) => candidate.id === row.id);
            if (existing) Object.assign(existing, row);
            else rows[table].push({ ...row });
          }
          return { error: null };
        },
        update: (values: Row) => ({
          eq: async (column: string, value: unknown) => {
            log.push(`update ${table} set ${Object.keys(values).join(",")}`);
            const target = (rows[table] ??= []).find((candidate) => candidate[column] === value);
            if (target) Object.assign(target, values);
            return { error: null };
          },
        }),
        select: () => ({
          eq: async () => ({ data: [], error: null }),
          in: async () => ({ data: [], error: null }),
        }),
        delete: () => ({ in: async () => ({ error: null }) }),
      };
    },
  };

  return writer as unknown as StructureWriter & { rows: Record<string, Row[]>; log: string[] };
}

describe("writeCourseStructure", () => {
  const course = getCourse("way21")!;

  it("writes a whole published course without tripping a NOT NULL column", () => {
    // The regression: this threw `lms_authoring_write_failed:lms_courses:null
    // value in column "slug"` for every course, on every writer — seed, import
    // and the builder's save and publish alike.
    return expect(writeCourseStructure(fakeWriter(), course)).resolves.toMatchObject({
      slug: "way21",
      status: "published",
      moduleCount: 5,
      lessonCount: 16,
    });
  });

  it("flips status and version by UPDATE, after the content is in", async () => {
    const db = fakeWriter();
    await writeCourseStructure(db, course);

    const statusStep = db.log.findIndex((entry) => entry.startsWith("update lms_courses"));
    expect(statusStep, "status must be an UPDATE, not a partial upsert").toBeGreaterThan(-1);
    // Last, so a publish never advertises content that failed to land.
    expect(statusStep).toBeGreaterThan(db.log.indexOf("upsert lms_lessons x16"));
    expect(db.rows.lms_courses[0]).toMatchObject({ slug: "way21", status: "published" });
  });

  it("refuses to publish a course that still owes the learner content", async () => {
    // The marker goes in a LESSON title: courseReadiness scans the course title,
    // lesson titles and block text, and deliberately not module titles.
    const holed = {
      ...course,
      modules: course.modules.map((module, index) =>
        index > 0
          ? module
          : {
              ...module,
              lessons: module.lessons.map((lesson, at) =>
                at > 0 ? lesson : { ...lesson, title: "[ЗАПОВНИ: назва уроку]" }
              ),
            }
      ),
    };
    await expect(writeCourseStructure(fakeWriter(), holed)).rejects.toThrow(/lms_authoring_not_publishable/);
  });

  it("writes the same course as a draft even with holes in it", async () => {
    const draft = { ...course, status: "draft" as const, title: "[ЗАПОВНИ: назва курсу]" };
    await expect(writeCourseStructure(fakeWriter(), draft)).resolves.toMatchObject({ status: "draft" });
  });
});
