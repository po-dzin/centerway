/**
 * The author overview's sentences, as pure functions.
 *
 * Separate from `BuilderDashboard.tsx` for the same reason `courseWorkspace.ts`
 * and `versionHistory.ts` are separate from their screens: these are the parts
 * that can be WRONG rather than merely ugly — a plural form, a day count off by
 * one, a visibility word that says the opposite of the column — and a pure
 * module is the only shape a test can hold them in.
 */

import { courseStateKeys, type CourseStateKey } from "@/lib/lms/courseState";
import { plural } from "@/lib/plural";
import type { BuilderCourseAudience, BuilderCourseSummary } from "./builderClient";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * «Скільки вже чекає», in the words a person uses for it.
 *
 * Whole days from the timestamp, not an hour count: the question behind it is
 * «чи не забули про мене», and that is answered in days. A submission with no
 * timestamp says so rather than reporting zero — `submitted_at` predates some
 * rows, and «надіслано сьогодні» about a course sent last month is worse than
 * admitting the date was never recorded.
 *
 * `now` is a parameter so the sentence is testable without freezing the clock.
 */
export function waitingFor(submittedAt: string | null, now: number = Date.now()): string {
  if (!submittedAt) return "дата надсилання не збережена";
  const sent = new Date(submittedAt);
  if (Number.isNaN(sent.getTime())) return "дата надсилання не збережена";
  const days = Math.floor((now - sent.getTime()) / DAY_MS);
  if (days <= 0) return "надіслано сьогодні";
  /* Ukrainian counts 2-4 apart from 5+, and by the LAST digit — 22 takes
     «дні», 12 takes «днів». `plural` is the repo's one implementation of that
     rule; a `days < 5` written here was right for the first four days and wrong
     for every month after. */
  return `чекає ${days} ${plural(days, "день", "дні", "днів")}`;
}

/**
 * What is stopping a publish, counted.
 *
 * `-1` is not "minus one blocker": it is `listBuilderCourses` reporting that
 * the stored rows do not currently form a valid course, which is a different
 * problem with a different first step — open it, read the validation error.
 */
export function blockerLine(blockerCount: number): string {
  if (blockerCount < 0) return "Структура курсу не проходить перевірку — відкрийте курс, щоб побачити помилку.";
  return `${blockerCount} ${plural(blockerCount, "блокер", "блокери", "блокерів")} публікації.`;
}

/**
 * Status and visibility are two switches, and this is the second one.
 *
 * `status: "published"` means the author finished it; `visibility` means the
 * house listed it. Collapsing them into one word is the confusion this cell
 * exists to prevent — a published course sitting at `hidden` is invisible to
 * everyone but its author, and nothing in the workshop used to say so.
 */
export function visibilityShort(visibility: BuilderCourseSummary["visibility"]): string {
  if (visibility === "listed") return "У каталозі";
  if (visibility === "unlisted") return "За посиланням";
  return "Приховано";
}

export type AudienceTotals = {
  learners: number;
  joinedRecently: number;
  activeRecently: number;
  completionsRecently: number;
  notStarted: number;
  finished: number;
  /** Weighted by learners, so a course of one does not move the mean as much as a course of forty. */
  progressShare: number | null;
};

/**
 * The tiles' numbers: the per-course counts added up.
 *
 * A person enrolled in two courses is two seats here — these are seats, and the
 * tile says «учні» about seats the same way every course row does. The daily
 * series is the one place people are deduplicated, and it says so.
 */
export function summarizeAudience(entries: BuilderCourseAudience[]): AudienceTotals {
  const totals: AudienceTotals = {
    learners: 0,
    joinedRecently: 0,
    activeRecently: 0,
    completionsRecently: 0,
    notStarted: 0,
    finished: 0,
    progressShare: null,
  };
  let weighted = 0;
  let weight = 0;
  for (const entry of entries) {
    totals.learners += entry.learners;
    totals.joinedRecently += entry.joinedRecently;
    totals.activeRecently += entry.activeRecently;
    totals.completionsRecently += entry.completionsRecently;
    totals.notStarted += entry.notStarted;
    totals.finished += entry.finished;
    if (entry.progressShare !== null && entry.learners > 0) {
      weighted += entry.progressShare * entry.learners;
      weight += entry.learners;
    }
  }
  totals.progressShare = weight > 0 ? weighted / weight : null;
  return totals;
}

const percentFormat = new Intl.NumberFormat("uk-UA", { style: "percent", maximumFractionDigits: 0 });

/** A share as a percentage, or a dash where there is nothing to measure. */
export function formatShare(share: number | null): string {
  return share === null ? "—" : percentFormat.format(share);
}

export function learnersCount(count: number): string {
  return `${count} ${plural(count, "учень", "учні", "учнів")}`;
}

const shortDayFormat = new Intl.DateTimeFormat("uk-UA", { day: "numeric", month: "short", timeZone: "UTC" });

/** «12 вер.» for a `YYYY-MM-DD` key — read as a calendar date, never shifted by a zone. */
export function shortDay(dateKey: string): string {
  const parsed = Date.parse(`${dateKey}T00:00:00Z`);
  return Number.isNaN(parsed) ? dateKey : shortDayFormat.format(new Date(parsed));
}

/** One day of the chart, as the readout says it. */
export function dayReadout(day: { date: string; learners: number }): string {
  return `${shortDay(day.date)} · ${day.learners === 0 ? "ніхто не відкривав уроки" : learnersCount(day.learners)}`;
}

const kyivDayKey = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Kyiv",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const kyivTime = new Intl.DateTimeFormat("uk-UA", { timeZone: "Europe/Kyiv", hour: "2-digit", minute: "2-digit" });
const kyivDate = new Intl.DateTimeFormat("uk-UA", { timeZone: "Europe/Kyiv", day: "numeric", month: "short" });
const kyivDateYear = new Intl.DateTimeFormat("uk-UA", {
  timeZone: "Europe/Kyiv",
  day: "numeric",
  month: "short",
  year: "numeric",
});

/**
 * When a journal entry happened, as short as it can be and still be exact:
 * «сьогодні, 19:52», «учора, 19:52», «13 вер., 19:52», and the year only when
 * it is not this one. The long «13 вер. 2026 р., 19:52» on every row was most
 * of what made the journal a wall.
 */
export function journalWhen(iso: string, now: number = Date.now()): string {
  const at = Date.parse(iso);
  if (Number.isNaN(at)) return "";
  const date = new Date(at);
  const key = kyivDayKey.format(date);
  const today = kyivDayKey.format(new Date(now));
  const yesterday = new Date(Date.parse(`${today}T00:00:00Z`) - DAY_MS).toISOString().slice(0, 10);
  const time = kyivTime.format(date);
  if (key === today) return `сьогодні, ${time}`;
  if (key === yesterday) return `учора, ${time}`;
  const sameYear = key.slice(0, 4) === today.slice(0, 4);
  return `${(sameYear ? kyivDate : kyivDateYear).format(date)}, ${time}`;
}

/**
 * The lifecycle words a course wears on the overview.
 *
 * NOT A SECOND VOCABULARY. The first draft printed «На перевірці» and «Потрібні
 * правки» in its own capsule; since 2026-09-14 every surface names a course's
 * state through `courseStateKeys`, so the overview asks the same function the
 * catalogue and the shelf ask and prints what it says — «Перевірка»,
 * «Повернуто», «Опубліковано», «Оновлення».
 */
export function overviewStateKeys(
  course: Pick<BuilderCourseSummary, "status" | "hasPendingRevision" | "liveReviewStatus" | "pendingReviewStatus">,
): CourseStateKey[] {
  return courseStateKeys({
    status: course.status,
    reviewStatus: course.liveReviewStatus,
    hasPendingRevision: course.hasPendingRevision,
    pendingReviewStatus: course.pendingReviewStatus,
  });
}
