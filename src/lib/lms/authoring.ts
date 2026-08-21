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

/** Minimal shape of the Supabase client this module needs — keeps it testable. */
export type StructureWriter = {
  from: (table: string) => {
    upsert: (
      rows: Record<string, unknown>[],
      options: { onConflict: string }
    ) => Promise<{ error: { message: string } | null }>;
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

  const write = async (table: string, payload: Record<string, unknown>[]) => {
    if (payload.length === 0) return;
    const { error } = await db.from(table).upsert(payload, { onConflict: "id" });
    if (error) throw new Error(`lms_authoring_write_failed:${table}:${error.message}`);
  };

  await write("lms_courses", [rows.course]);
  await write("lms_modules", rows.modules);
  await write("lms_lessons", rows.lessons);

  return {
    slug: course.slug,
    status: course.status,
    moduleCount: rows.modules.length,
    lessonCount: rows.lessons.length,
    blockers: readiness.blockers,
  };
}
