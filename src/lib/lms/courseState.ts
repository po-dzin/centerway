/**
 * ONE WORD FOR ONE STATE OF A COURSE, ON EVERY SURFACE (2026-09-14).
 *
 * The same course was named four ways: the admin publication tab printed two
 * chips — «Автор: опубліковано» and «Перевірка: затверджено» — for what the
 * builder called «Опубліковано»; the admin authorship tab printed the raw codes
 * `published` / `approved`; the learner shelf said «Чернетка» from a copy file of
 * its own. An operator moving between the builder and the catalogue had to
 * translate between them.
 *
 * So the lifecycle is folded here into single words, and every surface that
 * shows a course's state as a badge reads them from this file:
 *
 *   draft       Чернетка       not published, not waiting for anyone
 *   review      Перевірка      submitted, waiting for a moderator
 *   returned    Повернуто      a moderator sent it back with a note
 *   published   Опубліковано   live and approved (or live from before review existed)
 *   unreviewed  Неперевірено   live, but the review never happened
 *   update      Оновлення      a revision is being written on top of a live course
 *   on_sale     Продається     nothing stops it being bought
 *
 * Visibility (hidden / unlisted / listed) is not a lifecycle word: it is a
 * setting, and the row that can change it shows it in its own select.
 *
 * AND ONE TONE FOR EACH (2026-09-14), so the badge looks the same wherever the
 * word is printed — see `StateBadge`. Draft and published are neutral: the
 * normal state of a course being written, and the normal state of one that is
 * live, are facts, not news. Colour is kept for what asks something of the
 * reader (review, returned, unreviewed) and for the one «good to go» (on sale).
 */

import type { StateTone } from "@/lib/platform/stateTone";

export type CourseStateKey = "draft" | "review" | "returned" | "published" | "unreviewed" | "update" | "on_sale";

export const COURSE_STATE_LABELS: Record<CourseStateKey, { uk: string; en: string }> = {
  draft: { uk: "Чернетка", en: "Draft" },
  review: { uk: "Перевірка", en: "In review" },
  returned: { uk: "Повернуто", en: "Returned" },
  published: { uk: "Опубліковано", en: "Published" },
  unreviewed: { uk: "Неперевірено", en: "Unreviewed" },
  update: { uk: "Оновлення", en: "Update" },
  on_sale: { uk: "Продається", en: "On sale" },
};

export const COURSE_STATE_TONES: Record<CourseStateKey, StateTone> = {
  draft: "neutral",
  review: "running",
  returned: "pending",
  published: "neutral",
  unreviewed: "failed",
  update: "running",
  on_sale: "success",
};

export function courseStateLabel(key: CourseStateKey, lang: string): string {
  return COURSE_STATE_LABELS[key][lang === "en" ? "en" : "uk"];
}

export type CourseStateInput = {
  status: string;
  /** The LIVE course's review state. Null where the course predates review. */
  reviewStatus: string | null;
  hasPendingRevision: boolean;
  /** The pending revision's review state, when there is a revision. */
  pendingReviewStatus?: string | null;
};

/**
 * The badges a course wears, most important first: its own state, then — when
 * a revision sits on top of a live course — «Оновлення» and where that revision
 * is in review. Never two words for one fact.
 */
export function courseStateKeys(input: CourseStateInput): CourseStateKey[] {
  const keys: CourseStateKey[] = [];

  if (input.status === "published") {
    keys.push(
      input.reviewStatus === null || input.reviewStatus === "approved"
        ? "published"
        : input.reviewStatus === "in_review"
          ? "review"
          : /* A live course a moderator sent back: `moderateCourse` keeps
               `status` published and sets `changes_requested`. That is an
               explicit decision, and the catalogue groups it as returned. */
            input.reviewStatus === "changes_requested"
            ? "returned"
            : "unreviewed",
    );
  } else {
    keys.push(
      input.reviewStatus === "in_review" ? "review" : input.reviewStatus === "changes_requested" ? "returned" : "draft",
    );
  }

  if (input.hasPendingRevision) {
    keys.push("update");
    if (input.pendingReviewStatus === "in_review") keys.push("review");
    if (input.pendingReviewStatus === "changes_requested") keys.push("returned");
  }

  return [...new Set(keys)];
}
