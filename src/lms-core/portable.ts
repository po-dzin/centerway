/**
 * A portable course is the same `Course` JSON the CLI snapshots and imports.
 *
 * Importing is deliberately a COPY operation, never an upsert of the ids a
 * foreign file declares. The file may have come from another environment (or
 * be an older export of this one), so trusting its row ids would let it rewrite
 * an existing course. Every identity is minted again and every import starts as
 * a hidden draft with no commerce binding.
 */

import { validateCourse, type Course } from "./course";
import { courseReadiness, type CourseReadiness } from "./readiness";
import { uniqueSlug, type IdSource } from "./drafts";
import type { LessonBlock } from "./blocks";

export type PortableCoursePreview = {
  course: Course;
  readiness: CourseReadiness;
  summary: {
    sourceSlug: string;
    slug: string;
    title: string;
    locale: Course["locale"];
    moduleCount: number;
    lessonCount: number;
    blockCount: number;
  };
};

function freshBlock(block: LessonBlock, ids: IdSource): LessonBlock {
  const copied = { ...block, id: ids() } as LessonBlock;

  if (copied.type === "checklist") {
    return {
      ...copied,
      items: copied.items.map((item) => ({ ...item, id: ids() })),
    };
  }

  if (copied.type === "faq_block") {
    return {
      ...copied,
      items: copied.items.map((item) => ({ ...item, id: ids() })),
    };
  }

  return copied;
}

/**
 * Validate and turn an exported course into a new, inert Builder draft.
 *
 * The source is validated before any normalization. This matters: silently
 * filling missing fields would turn an incomplete transfer into content the
 * author may mistake for a faithful copy.
 */
export function preparePortableCourse(
  input: unknown,
  options: { takenSlugs: Iterable<string>; ids: IdSource },
): PortableCoursePreview {
  validateCourse(input, "portable");
  const source = input as Course;

  const course: Course = {
    ...source,
    id: options.ids(),
    slug: uniqueSlug(source.slug, options.takenSlugs),
    translationGroupId: options.ids(),
    status: "draft",
    version: 1,
    entitlementProductCodes: [],
    visibility: "hidden",
    modules: source.modules.map((module) => ({
      ...module,
      id: options.ids(),
      lessons: module.lessons.map((lesson) => ({
        ...lesson,
        id: options.ids(),
        blocks: lesson.blocks.map((block) => freshBlock(block, options.ids)),
      })),
    })),
  };
  delete course.sortOrder;

  // Prove the normalized copy satisfies the same contract before a caller can
  // show a preview or write it. Readiness blockers are allowed on drafts and
  // are part of the preview rather than an import failure.
  validateCourse(course, "portable.draft");
  const readiness = courseReadiness(course);
  const lessons = course.modules.flatMap((module) => module.lessons);

  return {
    course,
    readiness,
    summary: {
      sourceSlug: source.slug,
      slug: course.slug,
      title: course.title,
      locale: course.locale,
      moduleCount: course.modules.length,
      lessonCount: lessons.length,
      blockCount: lessons.reduce((count, lesson) => count + lesson.blocks.length, 0),
    },
  };
}
