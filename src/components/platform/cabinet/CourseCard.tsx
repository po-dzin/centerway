"use client";

/**
 * One course, as it appears on the shelf.
 *
 * Its own file because the dashboard needs `courseAction` for the resume card
 * while only `/learn` renders the card itself — and the two must never disagree
 * about where "Продовжити" goes.
 */

import Link from "next/link";

import { ProgressRail } from "@/components/platform/ProgressRail";
import { resolvePlatformHref } from "@/components/platform/layout/usePlatformHref";
import type { LearnerShelfCourseDto } from "@/components/lms/lmsClient";
import { fmtShortDate } from "./format";
import type { CabinetCopy } from "./copy";
import styles from "./Cabinet.module.css";

/* Every panel on this page is the same canonical surface. Spread rather than
   written out per element so a panel cannot be added without one: the recipe
   in globals.css owns stroke, grain and shadow, and the cabinet's own CSS is
   layout only. See docs/design-system.md "Material layer". */
export const matte = { "data-cw-material": "matte" } as const;

export function courseMapHref(course: LearnerShelfCourseDto) {
  return `/learn/${course.slug}`;
}

/** Where a shelf entry sends the learner, and what the button says. */
export function courseAction(course: LearnerShelfCourseDto, copy: CabinetCopy) {
  const map = courseMapHref(course);

  if (course.access === "locked") {
    return { href: `/programs/${course.programSlug}`, label: copy.openProgramPage, primary: false };
  }
  if (course.access === "available") {
    return { href: map, label: copy.startAction, primary: true };
  }
  if (course.standing?.isFinished || !course.currentLessonSlug) {
    return { href: map, label: copy.openCourseMap, primary: false };
  }

  return { href: `/learn/${course.slug}/${course.currentLessonSlug}`, label: copy.continueAction, primary: true };
}

export function CourseCard({
  course,
  copy,
  dateLocale,
}: {
  course: LearnerShelfCourseDto;
  copy: CabinetCopy;
  dateLocale: string;
}) {
  const action = courseAction(course, copy);
  const done = course.standing?.completedLessons ?? 0;
  const total = course.standing?.totalLessons ?? 0;

  const stateChip =
    course.access === "locked"
      ? course.lockReason === "expired"
        ? copy.courseExpired
        : copy.courseLocked
      : course.access === "available"
        ? copy.courseNotStarted
        : course.standing?.isFinished
          ? copy.courseFinished
          : null;

  return (
    <article className={course.access === "locked" ? styles.cardMuted : styles.card} {...matte}>
      <div className={styles.chipRow}>
        {stateChip ? (
          <span className={course.standing?.isFinished ? styles.chipDone : styles.chip}>{stateChip}</span>
        ) : null}
        {course.access === "enrolled" && total > 0 ? (
          <span className={styles.chip}>{copy.stepsOf(done, total)}</span>
        ) : null}
        {course.standing?.currentDay ? (
          <span className={styles.chip}>{copy.dayNumber(course.standing.currentDay)}</span>
        ) : null}
        {course.status === "draft" ? <span className={styles.chip}>{copy.courseDraft}</span> : null}
      </div>

      <h3 className={styles.cardTitle}>{course.title}</h3>
      {course.summary ? <p className={styles.cardText}>{course.summary}</p> : null}

      {course.access === "enrolled" && total > 0 ? (
        <ProgressRail value={done} total={total} label={course.title} />
      ) : null}

      <ul className={styles.metaList}>
        {course.currentLessonTitle && !course.standing?.isFinished ? (
          <li>
            {copy.nextStepLabel}: <strong>{course.currentLessonTitle}</strong>
          </li>
        ) : null}
        {course.startedAt ? (
          <li>
            {copy.startedAtLabel}: <strong>{fmtShortDate(course.startedAt, dateLocale)}</strong>
          </li>
        ) : null}
      </ul>

      <div className={styles.actions}>
        <Link
          className={action.primary ? styles.actionPrimary : styles.actionGhost}
          href={resolvePlatformHref(action.href)}
        >
          {action.label}
        </Link>
        {course.access !== "locked" && action.href !== courseMapHref(course) ? (
          <Link className={styles.actionGhost} href={resolvePlatformHref(courseMapHref(course))}>
            {copy.openCourseMap}
          </Link>
        ) : null}
      </div>
    </article>
  );
}

export function ShelfErrorCard({ copy, onRetry }: { copy: CabinetCopy; onRetry: () => void }) {
  return (
    <article className={styles.card} {...matte}>
      <h3 className={styles.cardTitle}>{copy.shelfErrorTitle}</h3>
      <p className={styles.cardText}>{copy.shelfErrorLead}</p>
      <div className={styles.actions}>
        <button className={styles.actionGhost} type="button" onClick={onRetry}>
          {copy.retry}
        </button>
      </div>
    </article>
  );
}

export function ShelfEmptyCard({ copy, programsHref }: { copy: CabinetCopy; programsHref: string }) {
  return (
    <article className={styles.card} {...matte}>
      <h3 className={styles.cardTitle}>{copy.learningEmptyTitle}</h3>
      <p className={styles.cardText}>{copy.learningEmptyLead}</p>
      <div className={styles.actions}>
        <Link className={styles.actionPrimary} href={programsHref}>
          {copy.browsePrograms}
        </Link>
      </div>
    </article>
  );
}
