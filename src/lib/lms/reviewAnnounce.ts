/**
 * «Хтось надіслав курс на перевірку» — said out loud, once, to the house.
 *
 * WHAT WAS MISSING. Submitting a course for review wrote `in_review` and a
 * journal entry and then waited: the only surface that shows the queue is
 * `/admin/catalog`, which nobody opens unless they already suspect something is
 * in it. With one author — the house itself — that was invisible, because the
 * person submitting was the person approving. With a second author it is a
 * course sitting untouched for as long as it takes somebody to wander past the
 * admin panel.
 *
 * NOT FOR AN ADMIN'S OWN SUBMISSION, and that is not a filter for noise — it is
 * the truth about who is waiting. An admin submitting is an admin who is about
 * to approve (the builder's own publish button does both in one press); there
 * is no request pending on anybody. Announcing it would train the group to read
 * «публікація» as something that needs no answer, which is how the message that
 * DOES need one gets skimmed past.
 *
 * The skip is decided here rather than at the call sites so there is one
 * statement of the rule and one place to test it — the routes only report who
 * they are, which each of them knows for certain.
 */

import { surfaceUrl } from "@/lib/surfaces/catalog";
import { notifyHouseThread, type HouseNotice } from "@/lib/telegram/houseThread";

export type ReviewSubmission = {
  slug: string;
  title: string;
  /** Who sent it, in the only terms the group can act on. */
  actorEmail: string | null;
  /** An update to a published course, as opposed to a first publication. */
  isRevision: boolean;
};

/**
 * The message, as plain text.
 *
 * Pure, so the wording is testable without a Telegram token — and so the two
 * facts the reader needs before opening anything (which course, and whether
 * learners are already reading it) are in the first two lines rather than
 * behind a link.
 */
export function formatReviewSubmission(submission: ReviewSubmission): string {
  return [
    "📤 Публікація — курс на перевірці",
    `${submission.title} (${submission.slug})`,
    submission.isRevision
      ? "Оновлення вже опублікованого курсу. Учні бачать поточну версію, доки оновлення не затвердять."
      : "Перша публікація. Курс ще не бачив ніхто.",
    submission.actorEmail ? `Автор: ${submission.actorEmail}` : null,
    "",
    surfaceUrl("/admin/catalog"),
  ]
    .filter((line) => line !== null)
    .join("\n");
}

/**
 * Announces a submission, unless the person who submitted it is the person who
 * approves. Never throws — see `notifyHouseThread`.
 */
export async function announceReviewSubmitted(
  submission: ReviewSubmission & { actorIsAdmin: boolean },
): Promise<HouseNotice | "skipped_admin"> {
  if (submission.actorIsAdmin) return "skipped_admin";
  return notifyHouseThread(formatReviewSubmission(submission));
}
