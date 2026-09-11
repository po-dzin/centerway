"use client";

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
     they can act on: save first, then the blockers, both of which the release
     panel lists by name. A disabled control with no reason beside it is the
     thing this notice exists to stop being. */
  const refusal = dirty ? "Спочатку збережіть зміни." : !ready ? `Лишилось блокерів: ${blockerCount}.` : null;

  return (
    <aside className={styles.revisionNotice} aria-label="Стан цієї версії">
      <p className={styles.revisionNoticeText}>
        {submitted
          ? "Оновлення на перевірці. Учні поки бачать поточну версію."
          : "Учні бачать поточну версію. Ці зміни поїдуть до них після перевірки."}
        {review.status === "changes_requested" && review.note ? ` Коментар: ${review.note}` : ""}
        {refusal ? ` ${refusal}` : ""}
      </p>
      <div className={styles.revisionNoticeActions}>
        {submitted ? null : (
          <button className={styles.quietAction} type="button" onClick={onSubmit} disabled={busy || dirty || !ready}>
            Надіслати на перевірку
          </button>
        )}
        <a
          className={styles.revisionNoticeLink}
          href="#course-release"
          onClick={(event) => {
            event.preventDefault();
            onOpenRelease();
          }}
        >
          <InkLabel>Публікація</InkLabel>
        </a>
      </div>
    </aside>
  );
}
