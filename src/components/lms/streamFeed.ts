/**
 * The stream's day feed on a daily course's page (G, 2026-10-15): the days
 * behind, today, the days ahead, on the shared step line.
 *
 * Pure, so the folding rule is tested without rendering. The feed answers
 * «what is today and what comes next»; how far the whole course has come is
 * the shelf card's rail, so the course page no longer draws it twice.
 */
import type { CourseOutlineEntryDto } from "./lmsClient";

export type FeedState = "done" | "current" | "next";

export type FeedStep = { entry: CourseOutlineEntryDto; state: FeedState; today: boolean };

/** Done days kept in view right above today; the earlier ones fold into one link. */
export const FEED_DONE_IN_VIEW = 2;

export function streamFeed(
  steps: CourseOutlineEntryDto[],
  currentLessonSlug: string | null,
  currentDay: number | null,
  expanded: boolean,
): { visible: FeedStep[]; folded: number } {
  const all = steps.map<FeedStep>((entry) => ({
    entry,
    state: entry.completed ? "done" : entry.slug === currentLessonSlug ? "current" : "next",
    today: currentDay !== null && entry.dayIndex === currentDay,
  }));

  /* Only the unbroken run of done days at the top folds: a skipped day in the
     middle stays on screen, because it is the thing worth seeing. */
  const leadingDone = all.findIndex((step) => step.state !== "done");
  const run = leadingDone === -1 ? all.length : leadingDone;
  const folded = expanded ? 0 : Math.max(0, run - FEED_DONE_IN_VIEW);
  return { visible: all.slice(folded), folded };
}
