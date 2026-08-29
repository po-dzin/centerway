import { describe, expect, it } from "vitest";

import { courseFromRows, preserveFileAnnotations, writeCourseStructure, type StructureWriter } from "./authoring";
import { getSnapshotCourse } from "./catalog";
import type { Course } from "@/lms-core";

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
  const course = getSnapshotCourse("way21")!;

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

  /**
   * The Reset Day wipe (2026-08-26): a publish carrying a course object captured
   * before the offer-surface columns existed blanked the whole storefront, and the
   * course fell off the shelf. Both halves are locked here, because the fix is a
   * distinction — absence means "cleared" only when the caller says it does.
   */
  describe("a payload that does not carry a storefront", () => {
    /* A DRAFT, because the subject here is column writing and not publishing.
       `writeCourseStructure` refuses to store a PUBLISHED course that is not
       showcase-ready, and the whole point of `partial` below is that it omits
       the storefront fields — including the tagline that gate requires. Left
       published, both cases fail on a rule neither of them is about. */
    const draft = { ...course, status: "draft" as const };
    const stored = {
      ...draft,
      tagline: "Двадцять один день",
      audience: ["Для тих, хто починає"],
      accessNote: "Доступ на рік",
    };
    const partial = { ...draft };
    delete (partial as Record<string, unknown>).tagline;
    delete (partial as Record<string, unknown>).audience;
    delete (partial as Record<string, unknown>).accessNote;

    it("leaves the stored copy alone by default, rather than blanking it", async () => {
      const db = fakeWriter();
      await writeCourseStructure(db, partial);

      const written = db.rows.lms_courses[0];
      expect(Object.keys(written)).not.toContain("tagline");
      expect(Object.keys(written)).not.toContain("audience");
      expect(Object.keys(written)).not.toContain("access_note");
    });

    it("still writes the columns the payload does carry", async () => {
      const db = fakeWriter();
      await writeCourseStructure(db, stored);

      expect(db.rows.lms_courses[0]).toMatchObject({
        tagline: "Двадцять один день",
        audience: ["Для тих, хто починає"],
        access_note: "Доступ на рік",
      });
    });

    it("blanks them when the caller speaks for the storefront, so an author can clear a field", async () => {
      const db = fakeWriter();
      await writeCourseStructure(db, partial, { optionalColumns: "authoritative" });

      expect(db.rows.lms_courses[0]).toMatchObject({
        tagline: null,
        audience: null,
        access_note: null,
      });
    });
  });

  /**
   * Price is the owner's, not the author's. That boundary is currently held by
   * the authoring code simply never naming `lms_course_offers` — RLS cannot hold
   * it, because every authoring route runs as service role. So the convention is
   * asserted here: the day someone generalises this write over "everything on the
   * course", this fails instead of quietly handing authors their own pricing.
   */
  it("never writes the offer table, whatever the payload says", async () => {
    const db = fakeWriter();
    await writeCourseStructure(db, {
      ...course,
      // A payload trying to smuggle commerce in through the authoring door.
      ...({ amount: 1, price: 795, offer: { code: "course:way21", amount: 1 } } as object),
    });

    const tablesTouched = db.log.map((entry) => entry.split(" ")[1]);
    expect(tablesTouched).not.toContain("lms_course_offers");
    expect(Object.keys(db.rows)).not.toContain("lms_course_offers");
    expect(Object.keys(db.rows.lms_courses[0])).toEqual(
      expect.not.arrayContaining(["amount", "price", "offer", "list_amount", "currency"])
    );
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

  it("refuses the save when a removed lesson has learner progress", async () => {
    // Module 0 has exactly one lesson — removing it would empty the module,
    // which `validateCourse` refuses before this code is ever reached. Module 1
    // has four, so removing its first lesson leaves a valid course behind.
    const touchedLesson = course.modules[1].lessons[0];
    const withLessonRemoved: Course = {
      ...course,
      modules: [
        course.modules[0],
        { ...course.modules[1], lessons: course.modules[1].lessons.slice(1) },
        ...course.modules.slice(2),
      ],
    };

    const reconcileAwareWriter = (): StructureWriter & { deletedLessonIds: string[] } => {
      const base = fakeWriter();
      const deletedLessonIds: string[] = [];
      return {
        ...base,
        deletedLessonIds,
        from(table: string) {
          if (table === "lms_lessons") {
            return {
              ...base.from(table),
              select: () => ({
                eq: async () => ({
                  data: course.modules.flatMap((module) => module.lessons.map((lesson) => ({ id: lesson.id }))),
                  error: null,
                }),
                in: async () => ({ data: [], error: null }),
              }),
              delete: () => ({
                in: async (_column: string, ids: string[]) => {
                  deletedLessonIds.push(...ids);
                  return { error: null };
                },
              }),
            };
          }
          if (table === "lms_modules") {
            return {
              ...base.from(table),
              select: () => ({ eq: async () => ({ data: [], error: null }) }),
            };
          }
          if (table === "lms_progress_events") {
            return {
              select: () => ({
                in: async () => ({ data: [{ lesson_id: touchedLesson.id }], error: null }),
              }),
            };
          }
          return base.from(table);
        },
      } as unknown as StructureWriter & { deletedLessonIds: string[] };
    };

    const db = reconcileAwareWriter();
    await expect(writeCourseStructure(db, withLessonRemoved)).rejects.toThrow(
      "lms_authoring_reconcile_lesson_has_learners",
    );
    // The refusal must not be a formality: the touched lesson stays in place,
    // not quietly deleted before the throw.
    expect(db.deletedLessonIds).toEqual([]);
  });

  it("writes the same course as a draft even with holes in it", async () => {
    const draft = { ...course, status: "draft" as const, title: "[ЗАПОВНИ: назва курсу]" };
    await expect(writeCourseStructure(fakeWriter(), draft)).resolves.toMatchObject({ status: "draft" });
  });
});

/**
 * The builder's save, followed all the way back out again.
 *
 * This is the pass that catches the quietest failure the wave-2 columns could
 * produce: a field the author sets, that `courseRows` forgets to write or
 * `courseFromRows` forgets to read. Nothing throws in either case — the value
 * simply is not there the next time the course is opened, and the author's own
 * choice of palette or cover has been silently discarded by the save that
 * reported success.
 */
describe("builder → rows → builder", () => {
  const shipped = getSnapshotCourse("reset-day")!;

  const edited: Course = {
    ...shipped,
    theme: { palette: "herbs", headingFont: "ui", scale: "generous" },
    cover: { src: "/cw/platform/programs/reset-day-card-v1.png", alt: "Обкладинка курсу" },
    sortOrder: 3,
  };

  it("carries every authored field into the row set", async () => {
    const db = fakeWriter();
    await writeCourseStructure(db, edited);

    expect(db.rows.lms_courses[0]).toMatchObject({
      theme: { palette: "herbs", headingFont: "ui", scale: "generous" },
      cover: { src: "/cw/platform/programs/reset-day-card-v1.png", alt: "Обкладинка курсу" },
      sort_order: 3,
    });
  });

  it("marks the reference module as one, in a column rather than in a file", async () => {
    // Until 2026-08-21 `reference` had no column and was carried across from the
    // shipped JSON, so a module made in the builder could never become one.
    const db = fakeWriter();
    await writeCourseStructure(db, edited);

    const materials = db.rows.lms_modules.find((row) => row.slug === "materials");
    expect(materials?.reference).toBe(true);
    expect(db.rows.lms_modules.filter((row) => row.reference === true)).toHaveLength(1);
  });

  it("reads back as exactly the course that was written", async () => {
    const db = fakeWriter();
    await writeCourseStructure(db, edited);

    const restored = courseFromRows(db.rows.lms_courses[0], db.rows.lms_modules, db.rows.lms_lessons);

    // The `$`-prefixed keys are annotations on the FILE, not fields of the
    // course, and the database has no column for them — see
    // `preserveFileAnnotations`, which is what stops a pull from dropping them.
    const withoutAnnotations = Object.fromEntries(
      Object.entries(edited).filter(([key]) => !key.startsWith("$"))
    );
    // `version` is the one field the write owns rather than the payload — it is
    // bumped so clients can cache lesson bodies hard.
    expect(restored).toEqual({ ...withoutAnnotations, version: edited.version });
  });

  it("keeps the file's own annotations across a pull", async () => {
    // The real loss this caught: `lms:pull` is the documented way to bring an
    // author's edits back into git, and it overwrites the file wholesale. Both
    // shipped courses carry a `$content_note` recording who wrote the material
    // and what was decided about publishing it.
    const db = fakeWriter();
    await writeCourseStructure(db, edited);
    const restored = courseFromRows(db.rows.lms_courses[0], db.rows.lms_modules, db.rows.lms_lessons);

    const merged = preserveFileAnnotations(shipped as unknown as Record<string, unknown>, restored);

    expect(merged.$content_note).toBe((shipped as unknown as Record<string, unknown>).$content_note);
    expect(merged.$schema_note).toBe((shipped as unknown as Record<string, unknown>).$schema_note);
    // And the course itself is the one that came out of the database.
    expect(merged.theme).toEqual({ palette: "herbs", headingFont: "ui", scale: "generous" });
  });

  it("never lets an annotation shadow a course field", async () => {
    const merged = preserveFileAnnotations({ $note: "x", title: "стара назва" }, shipped);
    expect(merged.title).toBe(shipped.title);
    expect(merged.$note).toBe("x");
  });

  it("keeps a course that chose nothing free of empty theme and cover keys", async () => {
    // `{ theme: null }` and an absent `theme` are the same course, and they must
    // serialise the same way — otherwise `lms:pull` writes a diff into a file
    // nobody edited.
    // The shipped reset-day snapshot now has an explicit marketplace order, so
    // remove every optional presentation key to keep this fixture true to the
    // scenario the test names.
    const unconfigured = { ...shipped };
    delete unconfigured.theme;
    delete unconfigured.cover;
    delete unconfigured.sortOrder;
    // And no VISIBILITY either, which is the same scenario read one step
    // further: a course that chose nothing has not chosen to be in the
    // catalogue. Since 2026-08-28 the two are linked — the showcase blockers
    // (cover, section, duration, tagline) fire only once a course is pointed at
    // strangers — so a fixture that strips the cover while claiming a listed
    // shelf position is not "unconfigured", it is half-configured and
    // unpublishable. Absent reads back as `hidden`.
    delete unconfigured.visibility;

    const db = fakeWriter();
    await writeCourseStructure(db, unconfigured);
    const restored = courseFromRows(db.rows.lms_courses[0], db.rows.lms_modules, db.rows.lms_lessons);

    expect("theme" in restored).toBe(false);
    expect("cover" in restored).toBe(false);
    expect("sortOrder" in restored).toBe(false);
  });
});

describe("courseFromRows against an un-migrated database", () => {
  it("refuses rather than quietly dropping the reference flag", () => {
    // `select("*")` on a table without the column returns rows with no such
    // key. Reading those would export a course whose recipe module had rejoined
    // the numbered flow — with nothing anywhere saying so.
    const courseRow = { id: "c", slug: "s", title: "T", program_slug: "p", brand: "b", locale: "uk",
      translation_group_id: "g", status: "draft", version: 1, summary: null, schedule: { mode: "open" },
      entitlement_product_codes: [], theme: null, cover: null, sort_order: null };
    const moduleRow = { id: "m", course_id: "c", slug: "m", title: "M", order: 1, summary: null };
    const lessonRow = { id: "l", course_id: "c", module_id: "m", slug: "l", title: "L", order: 1,
      day_index: null, duration_min: null, summary: null, blocks: [{ id: "b", type: "rich_text", content: [{ kind: "p", text: "x" }] }] };

    expect(() => courseFromRows(courseRow, [moduleRow], [lessonRow])).toThrow(
      /lms_authoring_missing_reference_column/
    );
    // And with the column present it reads fine.
    expect(() => courseFromRows(courseRow, [{ ...moduleRow, reference: false }], [lessonRow])).not.toThrow();
  });
});
