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
import { ProgressRing } from "@/components/platform/ProgressRing";
import { useSurfaceHref } from "@/components/platform/layout/SurfaceHost";
import type { LearnerShelfCourseDto } from "@/components/lms/lmsClient";
import { CourseCover } from "./CourseCover";
import { fmtShortDate } from "./format";
import type { CabinetCopy } from "./copy";
import styles from "./Cabinet.module.css";

/* Every panel on this page is the same canonical surface. Spread rather than
   written out per element so a panel cannot be added without one: the recipe
   in globals.css owns stroke, grain and shadow, and the cabinet's own CSS is
   layout only. See docs/design-system.md "Material layer". */
export const matte = { "data-cw-material": "matte" } as const;

/* The cabinet's first screen stands ON a photograph, and an opaque panel there
   is a sheet of paper taped over the room: four white rectangles were the
   brightest thing on a screen whose subject is the picture behind them. Glass
   is the material written for exactly that ground — a warm tint with the blur
   under it, so the room still reads through the shelf. One depth only: the
   glances are glass, the card they stand beside is glass, and nothing nests. */
export const glassMedia = { "data-cw-material": "glass-media" } as const;

export function courseMapHref(course: LearnerShelfCourseDto) {
  return `/learn/${course.slug}`;
}

/**
 * Where a shelf entry sends the learner, and what the button says.
 *
 * A locked card is NOT a dead end. The brief is explicit that a course nobody
 * has bought stays visible with a way to buy it, and the same is true of one
 * whose window has closed — the offer page is where both go, the difference
 * being whether the button says "buy" or "renew". A banned seat is the one
 * case with nothing to sell: it names the state and offers support instead.
 */
export function courseAction(course: LearnerShelfCourseDto, copy: CabinetCopy) {
  const map = courseMapHref(course);

  if (course.access === "locked") {
    const label =
      course.lockReason === "expired"
        ? copy.renewAccess
        : course.lockReason === "not_entitled"
          ? copy.buyAccess
          : copy.openProgramPage;
    // The offer page is the one place that knows the price, so the card never
    // starts a checkout itself — it hands over to the surface that does.
    return {
      href: `/programs/${course.programSlug}`,
      label,
      // A closed window is the moment the buy button is the point of the card.
      primary: course.lockReason === "expired" || course.lockReason === "not_entitled",
    };
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
  const href = useSurfaceHref();
  const action = courseAction(course, copy);
  const done = course.standing?.completedLessons ?? 0;
  const total = course.standing?.totalLessons ?? 0;

  const stateChip =
    course.access === "locked"
      ? course.lockReason === "expired"
        ? copy.courseExpired
        : course.lockReason === "revoked"
          ? copy.courseRevoked
          : course.lockReason === "blocked"
            ? copy.courseBlocked
            : copy.courseLocked
      : course.access === "available"
        ? copy.courseNotStarted
        : course.standing?.isFinished
          ? copy.courseFinished
          : null;

  /* HOW LONG IS LEFT, not just until when. A date alone makes the learner do
     the arithmetic, and the answer they wanted was «ще встигаю» or «ні». Shown
     only while access is open — on a closed card the number is always zero and
     the chip beside it already said so. */
  const showsWindow = course.access !== "locked" && course.expiresAt !== null;

  return (
    <article className={course.access === "locked" ? styles.cardMuted : styles.card} {...matte}>
      {/* The picture the course was chosen by, kept after it was bought. */}
      <CourseCover course={course} dimmed={course.access === "locked"} />

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

      <h3 className={styles.courseCardTitle}>{course.title}</h3>
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
        {showsWindow && course.expiresAt ? (
          <li>
            {copy.accessUntilLabel}: <strong>{fmtShortDate(course.expiresAt, dateLocale)}</strong>
            {course.daysLeft !== null ? <> — {copy.daysLeft(course.daysLeft)}</> : null}
          </li>
        ) : null}
      </ul>

      <div className={styles.actions}>
        <Link
          className={action.primary ? styles.actionPrimary : styles.actionGhost}
          href={href(action.href)}
        >
          {action.label}
        </Link>
        {course.access !== "locked" && action.href !== courseMapHref(course) ? (
          <Link className={styles.actionGhost} href={href(courseMapHref(course))}>
            {copy.openCourseMap}
          </Link>
        ) : null}
      </div>
    </article>
  );
}

/**
 * The same course, one column narrower — the cabinet's shelf card.
 *
 * WHY A SECOND CARD AND NOT A PROP. The library's card is a full record: chips,
 * summary, when it started, when the window closes. The dashboard's question is
 * narrower — "what do I open, and how far in am I" — and the honest way to
 * answer it in a row of four is to print less, not to squeeze the same card. It
 * is the same OBJECT though, and that is why both live in this file and share
 * `courseAction`: cover, name, where you stopped, the rail, one control. Two
 * files would drift on where «Продовжити» goes within a week.
 *
 * ONE BUTTON, and that is the rule the whole row is built on. The resume card
 * used to carry «Продовжити» plus «Усі мої курси» — the second one duplicating
 * the doorway standing a few centimetres above it in the same block.
 *
 * AND NO KICKER OVER THE NAME. «Продовжити з місця зупинки» stood above the
 * title explaining the button at the foot of the same card, which already says
 * «Продовжити». A caption that narrates the control beside it is a label for a
 * reader who has not looked at the card.
 */
export function CompactCourseCard({
  course,
  copy,
  primary,
}: {
  course: LearnerShelfCourseDto;
  copy: CabinetCopy;
  /**
   * Whether this card carries the row's one gold button.
   *
   * MAX ONE PRIMARY PER VIEW is the button contract's rule, and a shelf is
   * exactly where it bites: four courses, four "continue" buttons, four gold
   * plates, and the card the dashboard is actually answering with disappears
   * into the row.
   *
   * It used to be inferred from a `label` prop — the kicker over the name, «
   * Продовжити з місця зупинки». That kicker is gone (the button under it says
   * «Продовжити», and a card does not need a caption explaining its own
   * control), so the flag says what it means instead of riding on a string.
   */
  primary?: boolean;
}) {
  const href = useSurfaceHref();
  const action = courseAction(course, copy);
  const done = course.standing?.completedLessons ?? 0;
  const total = course.standing?.totalLessons ?? 0;
  const resumable = course.access === "enrolled" && total > 0 && !course.standing?.isFinished;

  return (
    <article className={styles.shelfCard} {...glassMedia}>
      <CourseCover course={course} />
      <h3 className={styles.shelfCardTitle}>{course.title}</h3>
      {/* Where you stopped, or — for a course not started — what it costs to
          start. One line either way: a card in a row of four cannot afford a
          paragraph, and the library is one click away for the full record. */}
      <p className={styles.shelfCardNote}>
        {course.currentLessonTitle && !course.standing?.isFinished
          ? course.currentLessonTitle
          : course.standing?.isFinished
            ? copy.courseFinished
            : copy.courseNotStarted}
      </p>
      {resumable ? (
        <>
          <ProgressRail value={done} total={total} label={course.title} />
          <p className={styles.shelfCardMeta}>{copy.stepsOf(done, total)}</p>
        </>
      ) : null}
      <div className={styles.shelfCardAction}>
        <Link
          className={primary && action.primary ? styles.actionPrimary : styles.actionGhost}
          href={href(action.href)}
        >
          {action.label}
        </Link>
      </div>
    </article>
  );
}

/**
 * The same course as one line — the shelf's list view.
 *
 * The library offers two shapes of the same record (see `LearnShelfClient`):
 * a card, which is the course as an object with its picture and its state, and
 * this, which is the course as an ENTRY. Nine courses of card are seven screens
 * on a phone; nine of these are one and a half, and a reader looking for one
 * they own is reading titles, not pictures.

 * The whole tile is the link, so it carries no control of its own, and it says
 * only what tells two entries apart: the title, and where you stopped.
 *
 * THE RING, NOT THE RAIL. A rail is drawn along a card and takes its width; a
 * column of them would be wide bars saying what a 48px glyph says — the ring is
 * the same marks (one dash per lesson, the finished ones in accent) at a
 * fraction of the room. See `ProgressRing`.
 */
export function CourseRow({ course, copy }: { course: LearnerShelfCourseDto; copy: CabinetCopy }) {
  const href = useSurfaceHref();
  const action = courseAction(course, copy);
  const done = course.standing?.completedLessons ?? 0;
  const total = course.standing?.totalLessons ?? 0;
  const running = course.access === "enrolled" && total > 0 && !course.standing?.isFinished;

  return (
    <Link className={styles.glance} href={href(action.href)} {...matte}>
      {running ? (
        <ProgressRing className={styles.glanceRing} value={done} total={total} label={course.title} size={48} />
      ) : (
        <span className={styles.glanceRing} aria-hidden="true" />
      )}
      <span className={styles.glanceText}>
        <span className={styles.glanceTitle}>{course.title}</span>
        <span className={styles.glanceNote}>
          {running
            ? copy.stepsOf(done, total)
            : course.access === "locked"
              ? action.label
              : course.standing?.isFinished
                ? copy.courseFinished
                : copy.courseNotStarted}
        </span>
      </span>
    </Link>
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
