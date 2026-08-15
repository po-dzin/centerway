/**
 * CenterWay LMS core — progress as an event fold.
 *
 * PURE TS. No DOM, no React, no Next, no npm deps.
 *
 * Progress is stored as an append-only event log, not as mutable state. That is
 * what makes offline sync (native, H4) an idempotent replay instead of a merge,
 * and it matches the canon event bus (`lesson.started`, `lesson.completed`, …).
 * See docs/lms-research-2026-08-15.md §5A.
 *
 * Fold invariants:
 * - completion is monotonic — a later `lesson.started` never un-completes a lesson;
 * - checklist ticks are last-write-wins per item, ordered by `occurredAt`;
 * - events are deduplicated by `clientId`, so a retried offline flush is safe.
 */

export type ProgressEventType =
  | "lesson.started"
  | "lesson.completed"
  | "checklist.toggled";

export type ProgressEvent = {
  /** Client-generated idempotency key; unique per enrollment. */
  clientId: string;
  type: ProgressEventType;
  lessonId: string;
  occurredAt: string;
  payload?: {
    itemId?: string;
    checked?: boolean;
  };
};

export type LessonProgress = {
  lessonId: string;
  status: "not_started" | "started" | "completed";
  startedAt: string | null;
  completedAt: string | null;
  checklist: Record<string, boolean>;
};

export type CourseProgress = {
  lessons: Record<string, LessonProgress>;
  completedLessonIds: string[];
  lastActivityAt: string | null;
};

function emptyLesson(lessonId: string): LessonProgress {
  return {
    lessonId,
    status: "not_started",
    startedAt: null,
    completedAt: null,
    checklist: {},
  };
}

function timeOf(value: string): number {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

/**
 * Folds a raw event log into current progress.
 * Input order does not matter — events are sorted and deduplicated here.
 */
export function foldProgress(events: ProgressEvent[]): CourseProgress {
  const seen = new Set<string>();
  const ordered = [...events]
    .filter((event) => {
      if (seen.has(event.clientId)) return false;
      seen.add(event.clientId);
      return true;
    })
    .sort((a, b) => timeOf(a.occurredAt) - timeOf(b.occurredAt));

  const lessons: Record<string, LessonProgress> = {};
  let lastActivityAt: string | null = null;

  for (const event of ordered) {
    const current = lessons[event.lessonId] ?? emptyLesson(event.lessonId);
    lastActivityAt = event.occurredAt;

    switch (event.type) {
      case "lesson.started":
        lessons[event.lessonId] = {
          ...current,
          // Monotonic: a re-open of a finished lesson does not reset it.
          status: current.status === "completed" ? "completed" : "started",
          startedAt: current.startedAt ?? event.occurredAt,
        };
        break;

      case "lesson.completed":
        lessons[event.lessonId] = {
          ...current,
          status: "completed",
          startedAt: current.startedAt ?? event.occurredAt,
          completedAt: current.completedAt ?? event.occurredAt,
        };
        break;

      case "checklist.toggled": {
        const itemId = event.payload?.itemId;
        if (!itemId) break;
        lessons[event.lessonId] = {
          ...current,
          status: current.status === "not_started" ? "started" : current.status,
          startedAt: current.startedAt ?? event.occurredAt,
          checklist: { ...current.checklist, [itemId]: Boolean(event.payload?.checked) },
        };
        break;
      }
    }
  }

  const completedLessonIds = Object.values(lessons)
    .filter((lesson) => lesson.status === "completed")
    .map((lesson) => lesson.lessonId);

  return { lessons, completedLessonIds, lastActivityAt };
}

export function lessonProgressOf(progress: CourseProgress, lessonId: string): LessonProgress {
  return progress.lessons[lessonId] ?? emptyLesson(lessonId);
}

export function isLessonCompleted(progress: CourseProgress, lessonId: string): boolean {
  return lessonProgressOf(progress, lessonId).status === "completed";
}

/**
 * Whether every checklist item that gates completion has been ticked.
 * An empty requirement list means the lesson has no gate.
 */
export function checklistSatisfied(
  progress: CourseProgress,
  lessonId: string,
  requiredItemIds: string[]
): boolean {
  if (requiredItemIds.length === 0) return true;
  const checklist = lessonProgressOf(progress, lessonId).checklist;
  return requiredItemIds.every((itemId) => checklist[itemId] === true);
}

export function completionRatio(progress: CourseProgress, totalLessons: number): number {
  if (totalLessons <= 0) return 0;
  return Math.min(1, progress.completedLessonIds.length / totalLessons);
}
