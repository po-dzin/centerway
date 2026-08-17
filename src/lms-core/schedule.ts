/**
 * CenterWay LMS core — lesson availability (drip) and reminder timing.
 *
 * PURE TS. No DOM, no React, no Next, no npm deps.
 *
 * All calendar decisions run in the LEARNER's timezone (see ./time.ts).
 */

import { collectRequiredChecklistItemIds } from "./blocks";
import {
  countLessons,
  flattenLessons,
  flattenSteps,
  isReferenceLesson,
  type Course,
  type Lesson,
} from "./course";
import {
  checklistSatisfied,
  isLessonCompleted,
  type CourseProgress,
} from "./progress";
import { enrollmentDayNumber, localHour, resolveTimeZone } from "./time";

export type LessonAvailability =
  | { available: true }
  | { available: false; reason: "locked_by_sequence"; requiresLessonId: string }
  | { available: false; reason: "locked_by_day"; unlocksOnDay: number; daysRemaining: number };

export type LearnerContext = {
  /** When the learner got access. UTC instant. */
  startedAt: Date;
  timeZone: string;
  now: Date;
};

/**
 * Can this learner open this lesson right now?
 *
 * `open`       — always.
 * `sequential` — only if the previous lesson in walking order is completed.
 * `daily`      — only once the learner's local day number reaches `dayIndex`.
 */
export function lessonAvailability(
  course: Course,
  lesson: Lesson,
  progress: CourseProgress,
  context: LearnerContext
): LessonAvailability {
  const mode = course.schedule.mode;

  // Reference material is a lookup, available whenever it is needed — gating a
  // recipe behind a drip schedule would be absurd.
  if (isReferenceLesson(course, lesson.slug)) return { available: true };

  if (mode === "open") return { available: true };

  if (mode === "sequential") {
    const walk = flattenSteps(course);
    const index = walk.findIndex((entry) => entry.lesson.id === lesson.id);
    if (index <= 0) return { available: true };

    const previous = walk[index - 1].lesson;
    if (isLessonCompleted(progress, previous.id)) return { available: true };
    return { available: false, reason: "locked_by_sequence", requiresLessonId: previous.id };
  }

  const dayIndex = lesson.dayIndex ?? 1;
  const currentDay = enrollmentDayNumber(context.startedAt, context.now, resolveTimeZone(context.timeZone));
  if (currentDay >= dayIndex) return { available: true };

  return {
    available: false,
    reason: "locked_by_day",
    unlocksOnDay: dayIndex,
    daysRemaining: dayIndex - currentDay,
  };
}

/** Whether the learner is allowed to mark this lesson complete right now. */
export function canCompleteLesson(
  course: Course,
  lesson: Lesson,
  progress: CourseProgress,
  context: LearnerContext
): { allowed: true } | { allowed: false; reason: "unavailable" | "checklist_incomplete" } {
  const availability = lessonAvailability(course, lesson, progress, context);
  if (!availability.available) return { allowed: false, reason: "unavailable" };

  const required = collectRequiredChecklistItemIds(lesson.blocks);
  if (!checklistSatisfied(progress, lesson.id, required)) {
    return { allowed: false, reason: "checklist_incomplete" };
  }

  return { allowed: true };
}

/**
 * The lesson to send the learner to when they open the course:
 * the first available, uncompleted one — otherwise the last completed.
 */
export function resolveCurrentLesson(
  course: Course,
  progress: CourseProgress,
  context: LearnerContext
): Lesson | null {
  // Steps only: "continue where you left off" must never point at a recipe list.
  const walk = flattenSteps(course);
  if (walk.length === 0) return null;

  for (const entry of walk) {
    if (isLessonCompleted(progress, entry.lesson.id)) continue;
    if (lessonAvailability(course, entry.lesson, progress, context).available) return entry.lesson;
  }

  return walk[walk.length - 1].lesson;
}

export type CourseOutlineEntry = {
  moduleId: string;
  moduleTitle: string;
  /** Reference material — shown apart from the flow, not counted as a step. */
  isReference: boolean;
  lesson: Lesson;
  availability: LessonAvailability;
  completed: boolean;
};

/** The learner-facing course map: order, lock state and completion in one pass. */
export function buildOutline(
  course: Course,
  progress: CourseProgress,
  context: LearnerContext
): CourseOutlineEntry[] {
  return flattenLessons(course).map(({ module, lesson }) => ({
    moduleId: module.id,
    moduleTitle: module.title,
    isReference: module.reference === true,
    lesson,
    availability: lessonAvailability(course, lesson, progress, context),
    completed: isLessonCompleted(progress, lesson.id),
  }));
}

export type CourseStandingSummary = {
  totalLessons: number;
  completedLessons: number;
  currentDay: number | null;
  isFinished: boolean;
};

export function summarizeStanding(
  course: Course,
  progress: CourseProgress,
  context: LearnerContext
): CourseStandingSummary {
  const total = countLessons(course);
  const completed = progress.completedLessonIds.length;
  return {
    totalLessons: total,
    completedLessons: completed,
    currentDay:
      course.schedule.mode === "daily"
        ? enrollmentDayNumber(context.startedAt, context.now, resolveTimeZone(context.timeZone))
        : null,
    isFinished: total > 0 && completed >= total,
  };
}

export type ReminderDecision =
  | { send: false; reason: "not_daily" | "wrong_hour" | "finished" | "nothing_due" | "already_done" }
  | { send: true; lesson: Lesson; dayNumber: number };

/**
 * Called by the hourly cron for one enrollment.
 *
 * Fires only when the learner's LOCAL clock is at the course's reminder hour, so
 * a Kyiv-scheduled job never wakes someone in Vancouver at 3am (§3A.4).
 */
export function decideDailyReminder(
  course: Course,
  progress: CourseProgress,
  context: LearnerContext
): ReminderDecision {
  if (course.schedule.mode !== "daily") return { send: false, reason: "not_daily" };

  const zone = resolveTimeZone(context.timeZone);
  const reminderHour = course.schedule.reminderHour ?? 9;
  if (localHour(context.now, zone) !== reminderHour) return { send: false, reason: "wrong_hour" };

  const dayNumber = enrollmentDayNumber(context.startedAt, context.now, zone);
  const walk = flattenSteps(course);

  const dueToday = walk.find((entry) => (entry.lesson.dayIndex ?? 1) === dayNumber);
  if (!dueToday) {
    const maxDay = walk.reduce((max, entry) => Math.max(max, entry.lesson.dayIndex ?? 1), 0);
    return { send: false, reason: dayNumber > maxDay ? "finished" : "nothing_due" };
  }

  if (isLessonCompleted(progress, dueToday.lesson.id)) return { send: false, reason: "already_done" };

  return { send: true, lesson: dueToday.lesson, dayNumber };
}
