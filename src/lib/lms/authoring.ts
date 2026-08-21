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
    },
    modules: course.modules.map((module) => ({
      id: module.id,
      course_id: course.id,
      slug: module.slug,
      title: module.title,
      order: module.order,
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
 * `reference` has no column yet (it is a JSON-only flag), so the caller passes
 * the module slugs that carry it — today from the file being replaced.
 */
export function courseFromRows(
  courseRow: Record<string, unknown>,
  moduleRowsIn: Record<string, unknown>[],
  lessonRowsIn: Record<string, unknown>[],
  referenceSlugs: string[] = []
): Course {
  const reference = new Set(referenceSlugs);
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
        ...(reference.has(moduleRow.slug as string) ? { reference: true } : {}),
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
    modules,
  };

  validateCourse(course, `db:${course.slug}`);
  return course;
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
 * touched would erase their history along with it. A removed row that no
 * progress event references is deleted for real; one that does is left in
 * place — orphaned (visible to no course any more) rather than resurrected,
 * which is the safer of the two wrong states a naive delete could produce.
 * A soft-delete column is the real fix and belongs with a schema change, not
 * this pass.
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

  let deletableLessonIds = removedLessonIds;
  if (removedLessonIds.length > 0) {
    const { data: touched, error: progressError } = await db
      .from("lms_progress_events")
      .select("lesson_id")
      .in("lesson_id", removedLessonIds);
    if (progressError) {
      throw new Error(`lms_authoring_reconcile_read_failed:lms_progress_events:${progressError.message}`);
    }
    const touchedLessonIds = new Set(((touched ?? []) as { lesson_id: string }[]).map((row) => row.lesson_id));
    deletableLessonIds = removedLessonIds.filter((id) => !touchedLessonIds.has(id));
  }

  if (deletableLessonIds.length > 0) {
    const { error } = await db.from("lms_lessons").delete().in("id", deletableLessonIds);
    if (error) throw new Error(`lms_authoring_reconcile_delete_failed:lms_lessons:${error.message}`);
  }

  if (removedModuleIds.length === 0) return;

  // A removed module may only go if nothing still points at it — including a
  // lesson this same pass chose to preserve because a learner had touched it.
  // `lms_lessons.module_id` is `NOT NULL REFERENCES ... ON DELETE CASCADE`, so
  // deleting it out from under a preserved lesson would take the lesson (and
  // its progress) with it.
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

  // No cross-table transaction exists here — three independent requests, no
  // Postgres RPC — so this cannot be made fully atomic without one. What
  // ordering CAN bound is the one harm that actually matters: a publish that
  // reports success while the structure behind it is broken. `status` and
  // `version` are held back into their own write, last, so:
  //
  //  1. The course row is ensured first WITHOUT status/version — Supabase's
  //     upsert only touches the columns a payload names, so on an existing row
  //     this changes nothing yet, and on a brand-new row the table defaults
  //     (`status DEFAULT 'draft'`) apply. Either way `lms_modules`/`lms_lessons`
  //     get a valid `course_id` to reference (their FK is NOT NULL) before the
  //     next step needs it.
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
  await write("lms_courses", [{ id: rows.course.id, status: rows.course.status, version: rows.course.version }]);

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
