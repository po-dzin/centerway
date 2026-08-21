/**
 * CenterWay LMS core — course / module / lesson model.
 *
 * PURE TS. No DOM, no React, no Next, no npm deps.
 *
 * One contract, three writers (seed → builder → agent) and many renderers.
 * Shape mirrors ReOS `Архитектура.md` layer C: Program ⊃ Course ⊃ Module ⊃ Lesson ⊃ Block.
 */

import {
  assert,
  isNonEmptyString,
  isRecord,
  type InlineText,
  validateInlineText,
} from "./inline";
import { validateLessonBlock, type LessonBlock } from "./blocks";

/**
 * Content locale. Slot for the EN expansion (docs §3A) — the platform ships
 * uk/ru content only until the owner signals otherwise.
 */
export type CourseLocale = "uk" | "ru" | "en";

export type CourseStatus = "draft" | "published";

/**
 * How lessons are PACED.
 * - `open`       — no rhythm at all (reference material)
 * - `sequential` — the next lesson follows the previous one
 * - `daily`      — lesson N belongs to day N of the enrollment, in the LEARNER's timezone
 *
 * Pacing is not the same as locking — see `CourseSchedule.gate`.
 */
export type CourseScheduleMode = "open" | "sequential" | "daily";

/**
 * What the schedule does to a learner who runs ahead of it.
 *
 * - `soft` (default) — the day is GUIDANCE. Tomorrow's lesson opens today; the
 *   outline says which day it belongs to and the reminders still arrive on
 *   schedule. This is the honest default for a protocol you buy: a person has
 *   to see week 3 on day 1 to know what to order, and hiding the material they
 *   already paid for reads as a lock on their own purchase.
 * - `hard` — the lesson stays shut until its day. Reserve it for content that
 *   is genuinely unsafe or meaningless out of order.
 */
export type CourseScheduleGate = "soft" | "hard";

export type CourseSchedule = {
  mode: CourseScheduleMode;
  /** Defaults to `soft`. */
  gate?: CourseScheduleGate;
  /**
   * Anchor for `daily`: the enrollment's start date. `purchase` uses the
   * enrollment row, `date` uses a fixed cohort start.
   */
  start?: "purchase" | "date";
  startDate?: string;
  /** Local hour (0–23) for day-N reminders. Interpreted in the learner's timezone. */
  reminderHour?: number;
};

export type Lesson = {
  id: string;
  slug: string;
  title: string;
  /** 1-based position inside its module. */
  order: number;
  /** 1-based day for `daily` courses. Absent for open/sequential. */
  dayIndex?: number;
  durationMin?: number;
  summary?: InlineText;
  blocks: LessonBlock[];
};

export type CourseModule = {
  id: string;
  slug: string;
  title: string;
  order: number;
  /**
   * Reference material (recipes, glossaries, handbooks) rather than a step of
   * the protocol.
   *
   * Reference modules are always open, are excluded from the linear walk — so
   * "next step" never lands on a lookup table — and do not count toward course
   * completion. They are reached from a link in the content or from the contents
   * drawer, whenever the learner needs them.
   */
  reference?: boolean;
  summary?: InlineText;
  lessons: Lesson[];
};

export type Course = {
  id: string;
  slug: string;
  title: string;
  /** Catalog program this course delivers, e.g. "reset-day" (see platform/content.ts). */
  programSlug: string;
  /** Author brand — courses stay isolated per author (see multi-author hub). */
  brand: string;
  locale: CourseLocale;
  /**
   * Groups translations of the same course. Translations are separate rows, so
   * an EN version never blocks publishing the UK one. Slot only for now (§3A.3).
   */
  translationGroupId: string;
  status: CourseStatus;
  /** Bumped on any content change; lets clients cache lesson bodies hard. */
  version: number;
  summary?: InlineText;
  schedule: CourseSchedule;
  /**
   * Product codes that grant access to this course. Provider-agnostic on
   * purpose: WayForPay is one driver among future ones (§3A.1).
   */
  entitlementProductCodes: string[];
  modules: CourseModule[];
};

export function validateCourse(input: unknown, path = "course"): asserts input is Course {
  assert(isRecord(input), `lms_course_invalid_shape:${path}`);
  assert(isNonEmptyString(input.id), `lms_course_missing_id:${path}`);
  assert(isNonEmptyString(input.slug), `lms_course_missing_slug:${path}`);
  assert(isNonEmptyString(input.title), `lms_course_missing_title:${path}`);
  assert(isNonEmptyString(input.programSlug), `lms_course_missing_program:${path}`);
  assert(isNonEmptyString(input.brand), `lms_course_missing_brand:${path}`);
  assert(
    input.locale === "uk" || input.locale === "ru" || input.locale === "en",
    `lms_course_invalid_locale:${path}`
  );
  assert(isNonEmptyString(input.translationGroupId), `lms_course_missing_translation_group:${path}`);
  assert(input.status === "draft" || input.status === "published", `lms_course_invalid_status:${path}`);
  assert(
    typeof input.version === "number" && Number.isInteger(input.version) && input.version > 0,
    `lms_course_invalid_version:${path}`
  );
  if (input.summary !== undefined) validateInlineText(input.summary, `${path}.summary`);

  assert(
    Array.isArray(input.entitlementProductCodes) && input.entitlementProductCodes.every(isNonEmptyString),
    `lms_course_invalid_entitlement:${path}`
  );

  const schedule = input.schedule;
  assert(isRecord(schedule), `lms_course_missing_schedule:${path}`);
  assert(
    schedule.mode === "open" || schedule.mode === "sequential" || schedule.mode === "daily",
    `lms_course_invalid_schedule_mode:${path}`
  );
  if (schedule.gate !== undefined) {
    assert(schedule.gate === "soft" || schedule.gate === "hard", `lms_course_invalid_schedule_gate:${path}`);
  }
  if (schedule.reminderHour !== undefined) {
    assert(
      typeof schedule.reminderHour === "number" &&
        Number.isInteger(schedule.reminderHour) &&
        schedule.reminderHour >= 0 &&
        schedule.reminderHour <= 23,
      `lms_course_invalid_reminder_hour:${path}`
    );
  }
  if (schedule.mode === "daily" && schedule.start === "date") {
    assert(isNonEmptyString(schedule.startDate), `lms_course_missing_start_date:${path}`);
  }

  assert(Array.isArray(input.modules) && input.modules.length > 0, `lms_course_empty_modules:${path}`);

  const lessonSlugs = new Set<string>();
  const dayIndexes = new Set<number>();

  input.modules.forEach((module, moduleIndex) => {
    const modulePath = `${path}.modules[${moduleIndex}]`;
    assert(isRecord(module), `lms_module_invalid_shape:${modulePath}`);
    assert(isNonEmptyString(module.id), `lms_module_missing_id:${modulePath}`);
    assert(isNonEmptyString(module.slug), `lms_module_missing_slug:${modulePath}`);
    assert(isNonEmptyString(module.title), `lms_module_missing_title:${modulePath}`);
    assert(
      typeof module.order === "number" && Number.isInteger(module.order) && module.order > 0,
      `lms_module_invalid_order:${modulePath}`
    );
    if (module.reference !== undefined) {
      assert(typeof module.reference === "boolean", `lms_module_invalid_reference:${modulePath}`);
    }
    if (module.summary !== undefined) validateInlineText(module.summary, `${modulePath}.summary`);
    assert(Array.isArray(module.lessons) && module.lessons.length > 0, `lms_module_empty_lessons:${modulePath}`);

    module.lessons.forEach((lesson, lessonIndex) => {
      const lessonPath = `${modulePath}.lessons[${lessonIndex}]`;
      assert(isRecord(lesson), `lms_lesson_invalid_shape:${lessonPath}`);
      assert(isNonEmptyString(lesson.id), `lms_lesson_missing_id:${lessonPath}`);
      assert(isNonEmptyString(lesson.slug), `lms_lesson_missing_slug:${lessonPath}`);
      assert(isNonEmptyString(lesson.title), `lms_lesson_missing_title:${lessonPath}`);
      assert(
        typeof lesson.order === "number" && Number.isInteger(lesson.order) && lesson.order > 0,
        `lms_lesson_invalid_order:${lessonPath}`
      );

      // Lesson slugs are the URL key, so they must be unique across the course.
      assert(!lessonSlugs.has(lesson.slug), `lms_lesson_duplicate_slug:${lessonPath}`);
      lessonSlugs.add(lesson.slug);

      if (lesson.summary !== undefined) validateInlineText(lesson.summary, `${lessonPath}.summary`);

      // Reference material has no place in the day sequence — a recipe list is
      // not "day 4".
      if (schedule.mode === "daily" && module.reference !== true) {
        assert(
          typeof lesson.dayIndex === "number" && Number.isInteger(lesson.dayIndex) && lesson.dayIndex > 0,
          `lms_lesson_missing_day_index:${lessonPath}`
        );
        assert(!dayIndexes.has(lesson.dayIndex), `lms_lesson_duplicate_day_index:${lessonPath}`);
        dayIndexes.add(lesson.dayIndex);
      }

      assert(Array.isArray(lesson.blocks) && lesson.blocks.length > 0, `lms_lesson_empty_blocks:${lessonPath}`);
      lesson.blocks.forEach((block, blockIndex) => {
        validateLessonBlock(block, `${lessonPath}.blocks[${blockIndex}]`);
      });
    });
  });
}

/** Every lesson in the course, reference material included. */
export function flattenLessons(course: Course): Array<{ module: CourseModule; lesson: Lesson }> {
  return [...course.modules]
    .sort((a, b) => a.order - b.order)
    .flatMap((module) =>
      [...module.lessons]
        .sort((a, b) => a.order - b.order)
        .map((lesson) => ({ module, lesson }))
    );
}

/**
 * The steps a learner actually walks, in order — reference modules excluded.
 * This is the sequence behind "крок 3 з 5", prev/next, and completion.
 */
export function flattenSteps(course: Course): Array<{ module: CourseModule; lesson: Lesson }> {
  return flattenLessons(course).filter((entry) => !entry.module.reference);
}

/** Reference lessons, in order — rendered apart from the flow. */
export function flattenReference(course: Course): Array<{ module: CourseModule; lesson: Lesson }> {
  return flattenLessons(course).filter((entry) => entry.module.reference === true);
}

export function findLesson(course: Course, lessonSlug: string): { module: CourseModule; lesson: Lesson } | null {
  return flattenLessons(course).find((entry) => entry.lesson.slug === lessonSlug) ?? null;
}

export function isReferenceLesson(course: Course, lessonSlug: string): boolean {
  return findLesson(course, lessonSlug)?.module.reference === true;
}

/** Counts steps only: looking up a recipe is not course progress. */
export function countLessons(course: Course): number {
  return flattenSteps(course).length;
}
