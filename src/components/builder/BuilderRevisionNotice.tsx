"use client";

import { Icon } from "@/components/Icon";

import { InkLabel } from "./BuilderInkLabel";
import styles from "./Builder.module.css";
import type { BuilderCourseDto } from "./builderClient";

/**
 * WHAT LEARNERS ARE READING WHILE YOU EDIT.
 *
 * A published course has two versions: the release learners hold, and the one
 * being written. Saving writes the second (`saveBuilderCourse` stages it into
 * `pending_content`), and until an owner approves it the offer page and the
 * lessons keep printing the first. Nothing on the editing tabs said so — the
 * only sentence about it lived on «Публікація», three modes away from the field
 * being typed into — so «Зберегти» read as «опубліковано» and the storefront
 * looked broken.
 *
 * THE ACTION TRAVELS WITH THE SENTENCE. Telling an author their work is queued
 * and then sending them to another tab to queue it is the same omission one
 * step later: three courses sat in an unsubmitted revision for a week each.
 * Same call as the release panel's button, same refusals, so there is one way
 * to send an update and not two.
 *
 * NOT ON «Публікація» ITSELF — that panel says all of this at length and owns
 * the same button. This is the reminder for the tabs where the writing happens.
 *
 * ONE BUTTON, AND THE WAY IN IS THE SENTENCE (2026-09-20). There used to be a
 * second control beside it reading «Публікація», which named a TAB rather than
 * an act — so a row whose one real action is «send this for review» offered two
 * things to press and the bigger-looking one went somewhere. Where an author
 * actually wants to go from here is the list of what is still missing, and the
 * notice already says how many: so the count itself opens it, with an arrow
 * after it saying that it leads somewhere. When nothing is blocking, there is
 * nothing to go and look at, and the row is one button.
 */
export function BuilderRevisionNotice({
  review,
  ready,
  dirty,
  busy,
  blockerCount,
  onSubmit,
  onOpenRelease,
}: {
  review: BuilderCourseDto["review"];
  ready: boolean;
  dirty: boolean;
  busy: boolean;
  blockerCount: number;
  onSubmit: () => void;
  onOpenRelease: () => void;
}) {
  const submitted = review.status === "in_review";
  /* Why the button cannot be pressed, in the author's terms and in the order
     they can act on: save first, then the blockers. A disabled control with no
     reason beside it is the thing this notice exists to stop being.

     THE TWO REFUSALS ARE NOT THE SAME KIND. «Save first» is answered where the
     author already is — one press of a button they can see. «Blockers remain»
     is answered somewhere else, by a list of what they are, which is why only
     that one becomes a way in. */
  const blocked = !dirty && !ready;

  return (
    <aside className={styles.revisionNotice} aria-label="Стан цієї версії">
      <p className={styles.revisionNoticeText}>
        {submitted
          ? "Оновлення на перевірці. Учні поки бачать поточну версію."
          : "Учні бачать поточну версію. Ці зміни поїдуть до них після перевірки."}
        {review.status === "changes_requested" && review.note ? ` Коментар: ${review.note}` : ""}
        {dirty ? " Спочатку збережіть зміни." : ""}{" "}
        {blocked ? (
          /* The count and the way to see what it counts are one control: an
             author reading «лишилось блокерів: 1» is already asking «який»,
             and the arrow is the answer to that and not a second subject. */
          <button
            className={styles.revisionNoticeBlockerLink}
            type="button"
            onClick={onOpenRelease}
            aria-label={`Лишилось блокерів: ${blockerCount}. Показати, яких саме`}
          >
            <InkLabel>Лишилось блокерів: {blockerCount}</InkLabel>
            <Icon name="arrow-right" size={16} aria-hidden="true" />
          </button>
        ) : null}
      </p>
      {submitted ? null : (
        <div className={styles.revisionNoticeActions}>
          <button className={styles.quietAction} type="button" onClick={onSubmit} disabled={busy || dirty || !ready}>
            Надіслати на перевірку
          </button>
        </div>
      )}
    </aside>
  );
}
