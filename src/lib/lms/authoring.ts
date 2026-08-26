/**
 * The single write path for course structure.
 *
 * Three writers exist — me from the agent environment (`npm run lms:import`),
 * the author's builder in the cabinet (H2), and the author's agent (H3) — and
 * they are three UIs over this one function, not three pipelines. Whoever calls
 * it gets the same validation, the same publish gate and the same error codes.
 *
 * See docs/lms-authoring-pipeline-2026-08-19.md.
 *
 * This module owns the JSON ⇄ row mapping in both directions: `courseRows` for
 * writing, `courseFromRows` for the export back to git.
 */

import { courseReadiness, formatReadiness, validateCourse, type Course } from "@/lms-core";

type Row = Record<string, unknown>;
type DbResult<T> = Promise<{ data: T | null; error: { message: string } | null }>;

/** Minimal shape of the Supabase client this module needs — keeps it testable. */
export type StructureWriter = {
  from: (table: string) => {
    upsert: (rows: Row[], options: { onConflict: string }) => Promise<{ error: { message: string } | null }>;
    update: (values: Row) => {
      eq: (column: string, value: unknown) => Promise<{ error: { message: string } | null }>;
    };
    select: (columns: string) => {
      eq: (column: string, value: unknown) => DbResult<Row[]>;
      in: (column: string, values: unknown[]) => DbResult<Row[]>;
    };
    delete: () => {
      in: (column: string, values: unknown[]) => Promise<{ error: { message: string } | null }>;
    };
  };
};

export type CourseRows = {
  course: Record<string, unknown>;
  modules: Record<string, unknown>[];
  lessons: Record<string, unknown>[];
};

export function courseRows(course: Course): CourseRows {
  return {
    course: {
      id: course.id,
      slug: course.slug,
      title: course.title,
      program_slug: course.programSlug,
      brand: course.brand,
      locale: course.locale,
      translation_group_id: course.translationGroupId,
      status: course.status,
      version: course.version,
      summary: course.summary ?? null,
      schedule: course.schedule,
      entitlement_product_codes: course.entitlementProductCodes,
      theme: course.theme ?? null,
      cover: course.cover ?? null,
      sort_order: course.sortOrder ?? null,
      // Storefront. The author owns what the course claims about itself; the
      // PRICE is not here and never will be — it lives in `lms_course_offers`,
      // which the authoring routes have no grant on. See the 2026-08-22
      // migration for why that is a different table rather than a policy.
      tagline: course.tagline ?? null,
      results: course.results ?? null,
      visibility: course.visibility ?? "hidden",
      // The offer surface (2026-08-26). Everything the six hand-written program
      // pages could say and a builder course could not.
      audience: course.audience ?? null,
      format: course.format ?? null,
      duration: course.duration ?? null,
      access_note: course.accessNote ?? null,
      author_note: course.authorNote ?? null,
    },
    modules: course.modules.map((module) => ({
      id: module.id,
      course_id: course.id,
      slug: module.slug,
      title: module.title,
      order: module.order,
      reference: module.reference === true,
      summary: module.summary ?? null,
    })),
    lessons: course.modules.flatMap((module) =>
      module.lessons.map((lesson) => ({
        id: lesson.id,
        course_id: course.id,
        module_id: module.id,
        slug: lesson.slug,
        title: lesson.title,
        order: lesson.order,
        day_index: lesson.dayIndex ?? null,
        duration_min: lesson.durationMin ?? null,
        summary: lesson.summary ?? null,
        blocks: lesson.blocks,
      }))
    ),
  };
}

/**
 * Rebuilds the authored JSON from database rows — the export half of
 * "database is the source, git is the snapshot".
 *
 * `reference` is a column since 2026-08-21. It used to be a JSON-only flag the
 * caller had to supply from the file being replaced, which meant a module
 * created in the builder could never be reference material at all.
 */
export function courseFromRows(
  courseRow: Record<string, unknown>,
  moduleRowsIn: Record<string, unknown>[],
  lessonRowsIn: Record<string, unknown>[]
): Course {
  // A row set from a database that has not run the wave-2 migration carries no
  // `reference` key at all — and every reference module would then read back as
  // an ordinary one, silently: the flag would vanish from the exported file and
  // a recipe list would rejoin the numbered flow. The stopgap that used to carry
  // the flag across from the shipped JSON is gone, so this is now the only thing
  // standing between a missing column and lost content. Loud, and it names the
  // fix.
  const missingReference = moduleRowsIn.find((row) => !("reference" in row));
  if (missingReference) {
    throw new Error(
      "lms_authoring_missing_reference_column:run docs/migration/sql/2026-08-21_lms_builder_authoring.sql (see docs/lms-builder-2026-08-21.md)"
    );
  }

  const modules = [...moduleRowsIn]
    .sort((a, b) => Number(a.order) - Number(b.order))
    .map((moduleRow) => {
      const moduleId = moduleRow.id as string;
      const lessons = lessonRowsIn
        .filter((lessonRow) => lessonRow.module_id === moduleId)
        .sort((a, b) => Number(a.order) - Number(b.order))
        .map((lessonRow) => ({
          id: lessonRow.id as string,
          slug: lessonRow.slug as string,
          title: lessonRow.title as string,
          order: Number(lessonRow.order),
          ...(lessonRow.day_index === null ? {} : { dayIndex: Number(lessonRow.day_index) }),
          ...(lessonRow.duration_min === null ? {} : { durationMin: Number(lessonRow.duration_min) }),
          ...(lessonRow.summary === null ? {} : { summary: lessonRow.summary as never }),
          blocks: lessonRow.blocks as never,
        }));

      return {
        id: moduleId,
        slug: moduleRow.slug as string,
        title: moduleRow.title as string,
        order: Number(moduleRow.order),
        ...(moduleRow.reference === true ? { reference: true } : {}),
        ...(moduleRow.summary === null ? {} : { summary: moduleRow.summary as never }),
        lessons,
      };
    });

  const course = {
    id: courseRow.id as string,
    slug: courseRow.slug as string,
    title: courseRow.title as string,
    programSlug: courseRow.program_slug as string,
    brand: courseRow.brand as string,
    locale: courseRow.locale as never,
    translationGroupId: courseRow.translation_group_id as string,
    status: courseRow.status as never,
    version: Number(courseRow.version),
    ...(courseRow.summary === null ? {} : { summary: courseRow.summary as never }),
    schedule: courseRow.schedule as never,
    entitlementProductCodes: (courseRow.entitlement_product_codes ?? []) as string[],
    ...(courseRow.theme ? { theme: courseRow.theme as never } : {}),
    ...(courseRow.cover ? { cover: courseRow.cover as never } : {}),
    ...(courseRow.sort_order === null || courseRow.sort_order === undefined
      ? {}
      : { sortOrder: Number(courseRow.sort_order) }),
    // Read TOLERANTLY, unlike `reference` above, and the difference is what is
    // at stake. A missing `reference` column silently turned a recipe list back
    // into day 4 of the protocol — content lost. A missing storefront column
    // means the course is not on sale, which is the safe state and the default
    // the migration itself writes. So an older database reads back as hidden
    // rather than refusing to open.
    ...(courseRow.tagline ? { tagline: courseRow.tagline as string } : {}),
    ...(Array.isArray(courseRow.results) && courseRow.results.length > 0
      ? { results: courseRow.results as string[] }
      : {}),
    // `hidden` reads back as ABSENT, not as the string. It is the default the
    // column itself writes, so carrying it explicitly would put a field in every
    // exported course file that says what its absence already says — and would
    // make the round-trip through the database not equal what went in.
    ...(typeof courseRow.visibility === "string" && courseRow.visibility !== "hidden"
      ? { visibility: courseRow.visibility as never }
      : {}),
    // The offer surface, read as tolerantly as the storefront columns above and
    // for the same reason: a database without the 2026-08-26 migration has a
    // course that says less about itself, which the offer page already knows how
    // to render — it fell back to derived counts and a generic tag for months.
    ...(Array.isArray(courseRow.audience) && courseRow.audience.length > 0
      ? { audience: courseRow.audience as string[] }
      : {}),
    ...(Array.isArray(courseRow.format) && courseRow.format.length > 0
      ? { format: courseRow.format as string[] }
      : {}),
    ...(courseRow.duration ? { duration: courseRow.duration as string } : {}),
    ...(courseRow.access_note ? { accessNote: courseRow.access_note as string } : {}),
    ...(courseRow.author_note ? { authorNote: courseRow.author_note as string } : {}),
    modules,
  };

  validateCourse(course, `db:${course.slug}`);
  return course;
}

/**
 * Carries a course FILE's own annotations across a pull.
 *
 * `data/courses/*.json` holds keys the course contract knows nothing about and
 * the database has no column for — `$content_note` records who wrote the
 * material, where it came from and what was decided about publishing it;
 * `$schema_note` tells the next reader which validator owns the file. They are
 * annotations on the SNAPSHOT, not fields of the course, which is why they
 * belong to the repo and not to a table.
 *
 * `lms:pull` overwrites the file wholesale from database rows, so without this
 * the documented way to bring an author's edits back into git would silently
 * delete the provenance of the content it was preserving. Found by the
 * round-trip test in authoring.test.ts, not in production.
 *
 * `$` is the marker because it is already the convention in both shipped files
 * and cannot collide with a course field — no key of `Course` starts with one.
 */
export function preserveFileAnnotations(
  existing: Record<string, unknown> | null,
  next: Course
): Record<string, unknown> {
  if (!existing) return next as unknown as Record<string, unknown>;

  const annotations = Object.fromEntries(
    Object.entries(existing).filter(([key]) => key.startsWith("$"))
  );
  // Annotations first, so a course field can never be shadowed by one.
  return { ...annotations, ...(next as unknown as Record<string, unknown>) };
}

export type WriteCourseResult = {
  slug: string;
  status: Course["status"];
  moduleCount: number;
  lessonCount: number;
  /** Blockers found; on a draft these are informational, on publish they throw. */
  blockers: ReturnType<typeof courseReadiness>["blockers"];
};

/**
 * Validates, gates and writes one course's structure.
 *
 * Structure is upserted by the ids declared in the payload, so re-running is
 * safe and never orphans a learner's progress.
 */
/**
 * Rows that exist in the database under this course but are absent from the
 * incoming structure — deleted or moved out by whoever is editing.
 *
 * Deletion only happens where it is provably safe: `lms_progress_events.lesson_id`
 * is `ON DELETE CASCADE`, so hard-deleting a lesson a learner has actually
 * touched would erase their history along with it. But "leave the row in
 * place" is not the safe alternative it looks like: the row still carries its
 * original `course_id`/`module_id`, so `courseFromRows` picks it straight back
 * up on the very next read — the author gets a save that reports success and a
 * lesson that never left. A course whose removed lesson has progress is
 * refused outright instead; the author keeps the lesson (as a draft, hidden,
 * whatever the structure already allows) rather than being told it is gone
 * when it is not. A soft-delete/archive column is the real fix and belongs
 * with a schema change, not this pass.
 */
async function reconcileRemovedRows(db: StructureWriter, course: Course): Promise<void> {
  const keptModuleIds = new Set(course.modules.map((module) => module.id));
  const keptLessonIds = new Set(course.modules.flatMap((module) => module.lessons.map((lesson) => lesson.id)));

  const [{ data: dbModules, error: moduleReadError }, { data: dbLessons, error: lessonReadError }] = await Promise.all([
    db.from("lms_modules").select("id").eq("course_id", course.id),
    db.from("lms_lessons").select("id").eq("course_id", course.id),
  ]);
  if (moduleReadError) throw new Error(`lms_authoring_reconcile_read_failed:lms_modules:${moduleReadError.message}`);
  if (lessonReadError) throw new Error(`lms_authoring_reconcile_read_failed:lms_lessons:${lessonReadError.message}`);

  const removedLessonIds = ((dbLessons ?? []) as { id: string }[])
    .map((row) => row.id)
    .filter((id) => !keptLessonIds.has(id));
  const removedModuleIds = ((dbModules ?? []) as { id: string }[])
    .map((row) => row.id)
    .filter((id) => !keptModuleIds.has(id));

  if (removedLessonIds.length > 0) {
    const { data: touched, error: progressError } = await db
      .from("lms_progress_events")
      .select("lesson_id")
      .in("lesson_id", removedLessonIds);
    if (progressError) {
      throw new Error(`lms_authoring_reconcile_read_failed:lms_progress_events:${progressError.message}`);
    }
    const touchedLessonIds = new Set(((touched ?? []) as { lesson_id: string }[]).map((row) => row.lesson_id));
    if (touchedLessonIds.size > 0) {
      throw new Error(
        `lms_authoring_reconcile_lesson_has_learners:${[...touchedLessonIds].join(",")}`
      );
    }

    const { error } = await db.from("lms_lessons").delete().in("id", removedLessonIds);
    if (error) throw new Error(`lms_authoring_reconcile_delete_failed:lms_lessons:${error.message}`);
  }

  if (removedModuleIds.length === 0) return;

  // A removed module may only go if nothing still points at it. By this line
  // every removed lesson with progress has already thrown, so what is left to
  // check is ordinary: a kept lesson whose own row still names a module this
  // structure no longer has. `lms_lessons.module_id` is `NOT NULL REFERENCES
  // ... ON DELETE CASCADE`, so deleting the module out from under it would take
  // the lesson (and its progress) with it.
  const { data: survivors, error: survivorError } = await db
    .from("lms_lessons")
    .select("module_id")
    .in("module_id", removedModuleIds);
  if (survivorError) {
    throw new Error(`lms_authoring_reconcile_read_failed:lms_lessons:${survivorError.message}`);
  }
  const stillReferenced = new Set(((survivors ?? []) as { module_id: string }[]).map((row) => row.module_id));
  const deletableModuleIds = removedModuleIds.filter((id) => !stillReferenced.has(id));

  if (deletableModuleIds.length > 0) {
    const { error } = await db.from("lms_modules").delete().in("id", deletableModuleIds);
    if (error) throw new Error(`lms_authoring_reconcile_delete_failed:lms_modules:${error.message}`);
  }
}

export async function writeCourseStructure(
  db: StructureWriter,
  input: unknown
): Promise<WriteCourseResult> {
  validateCourse(input, "authoring");
  const course = input as Course;

  const readiness = courseReadiness(course);
  if (course.status === "published" && !readiness.ready) {
    throw new Error(`lms_authoring_not_publishable:${course.slug}\n${formatReadiness(readiness)}`);
  }

  const rows = courseRows(course);

  const write = async (table: string, payload: Row[]) => {
    if (payload.length === 0) return;
    const { error } = await db.from(table).upsert(payload, { onConflict: "id" });
    if (error) throw new Error(`lms_authoring_write_failed:${table}:${error.message}`);
  };

  /**
   * UPDATE, not a partial upsert.
   *
   * The status flip below used to be `upsert([{ id, status, version }])` on the
   * theory that an upsert "only touches the columns a payload names". That
   * holds for the DO UPDATE branch and not for the statement: Postgres builds
   * the proposed tuple and enforces NOT NULL on it BEFORE resolving the
   * conflict, so a partial row raises 23502 on `slug` even when the row plainly
   * exists. Every write through this function failed on it — seed, import, and
   * the builder's own save and publish.
   */
  const updateById = async (table: string, id: string, values: Row) => {
    const { error } = await db.from(table).update(values).eq("id", id);
    if (error) throw new Error(`lms_authoring_write_failed:${table}:${error.message}`);
  };

  // No cross-table transaction exists here — three independent requests, no
  // Postgres RPC — so this cannot be made fully atomic without one. What
  // ordering CAN bound is the one harm that actually matters: a publish that
  // reports success while the structure behind it is broken. `status` and
  // `version` are held back into their own write, last, so:
  //
  //  1. The course row is ensured first WITHOUT status/version. This one IS a
  //     full-row upsert, so it is legal: every NOT NULL column is present. On an
  //     existing row the named columns are refreshed and status/version are left
  //     alone; on a brand-new row the table defaults (`status DEFAULT 'draft'`)
  //     apply. Either way `lms_modules`/`lms_lessons` get a valid `course_id` to
  //     reference (their FK is NOT NULL) before the next step needs it.
  //  2. Modules, then lessons. If either fails, the course row's status is
  //     whatever it already was — never advanced to reflect content that never
  //     actually landed.
  //  3. Only once both have succeeded does the course row get its real
  //     `status`/`version` — the flip that makes a publish live happens last,
  //     not first.
  //
  // A module or lesson upsert can still fail after leaving earlier rows
  // written — that half is a real gap this does not close, and would need an
  // RPC to.
  const courseWithoutStatus = { ...rows.course };
  delete courseWithoutStatus.status;
  delete courseWithoutStatus.version;
  await write("lms_courses", [courseWithoutStatus]);
  await write("lms_modules", rows.modules);
  await write("lms_lessons", rows.lessons);
  await updateById("lms_courses", rows.course.id as string, {
    status: rows.course.status,
    version: rows.course.version,
  });

  // Reconciliation only after every upsert above has succeeded: it deletes by
  // diffing the database against the payload, and running it first — or
  // against a write that then fails — could delete rows a failed request
  // never actually replaced.
  await reconcileRemovedRows(db, course);

  return {
    slug: course.slug,
    status: course.status,
    moduleCount: rows.modules.length,
    lessonCount: rows.lessons.length,
    blockers: readiness.blockers,
  };
}
