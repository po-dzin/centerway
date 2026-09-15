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
 * Status and visibility are two switches, and this is the second one.
 *
 * `status: "published"` means the author finished it; `visibility` means the
 * house listed it. Collapsing them into one word is the confusion this line
 * exists to prevent — a published course sitting at `hidden` is invisible to
 * everyone but its author, and nothing in the workshop used to say so.
 */
export function visibilityLine(visibility: BuilderCourseSummary["visibility"]): string {
  if (visibility === "listed") return "У каталозі — курс видно всім.";
  if (visibility === "unlisted") return "Лише за прямим посиланням — у каталозі його немає.";
  return "Приховано з вітрини — сторонні його не бачать.";
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
 * «Скільки людей усередині, і скільки з них ще рухається».
 *
 * TWO NUMBERS IN ONE SENTENCE, and the second one is the honest half. A course
 * can hold forty people and be read by none of them; reporting only the total
 * would let an author mistake a list of buyers for an audience. Activity is
 * counted over `AUDIENCE_ACTIVE_DAYS` and only for seats whose access is still
 * open, so «7 активних» can never exceed the total beside it.
 */
export function audienceLine(audience: BuilderCourseAudience): string {
  const learners = `${audience.learners} ${plural(audience.learners, "учень", "учні", "учнів")}`;
  if (audience.learners === 0) return `${learners} з відкритим доступом.`;
  return `${learners} · ${audience.activeRecently} ${plural(audience.activeRecently, "активний", "активні", "активних")} за тиждень.`;
}

/**
 * What qualifies the count: who arrived lately, and whose access has closed.
 *
 * Null when there is nothing to add — a note that always renders is a note that
 * stops being read.
 */
export function audienceNote(audience: BuilderCourseAudience): string | null {
  const parts: string[] = [];
  if (audience.joinedRecently > 0) {
    parts.push(`+${audience.joinedRecently} ${plural(audience.joinedRecently, "новий", "нові", "нових")} за 30 днів`);
  }
  if (audience.lapsed > 0) {
    parts.push(
      `${audience.lapsed} ${plural(audience.lapsed, "доступ закінчився", "доступи закінчились", "доступів закінчились")}`,
    );
  }
  return parts.length > 0 ? parts.join(" · ") : null;
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
