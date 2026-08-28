"use client";

/**
 * Leaving the builder with changes the server has not seen.
 *
 * IT USED TO SAVE SILENTLY AND GO. That is right inside one course — moving to
 * a lesson and back is one act of editing — and wrong on the way out: the
 * author presses a link, a save they never asked for is attempted, and if it is
 * refused the page simply stays put with one line of explanation in a strip a
 * few words wide. Nobody reads a status line they did not expect to need.
 *
 * So the way OUT of the course asks. Three answers, and each is a real one:
 * save and leave, leave anyway, or stay. There is no fourth state where the
 * author is held on a page without knowing why.
 *
 * «ВИЙТИ БЕЗ ЗБЕРЕЖЕННЯ» ALSO DROPS THE LOCAL COPY, and the copy says so. The
 * durable draft exists to survive a session that ended by accident; a session
 * the author ended on purpose, having read the word «без збереження», is not
 * that — and offering the same changes back on the next visit would make the
 * choice they just made look like it did not happen.
 */

import styles from "./Builder.module.css";
import { BuilderDecision } from "./BuilderDecision";

export function BuilderExitPrompt({
  open,
  saving,
  failure,
  onSave,
  onLeave,
  onStay,
}: {
  open: boolean;
  saving: boolean;
  /** The server's refusal, in the author's words, if the save was tried here. */
  failure: string | null;
  onSave: () => void;
  onLeave: () => void;
  onStay: () => void;
}) {
  return (
    <BuilderDecision
      open={open}
      title={failure ? "Зміни не збережено" : "Є незбережені зміни"}
      onDismiss={onStay}
      actions={
        <>
          <button className={styles.commitAction} type="button" onClick={onSave} disabled={saving}>
            {saving ? "Зберігаємо…" : "Зберегти й вийти"}
          </button>
          <button className={styles.dangerAction} type="button" onClick={onLeave} disabled={saving}>
            Вийти без збереження
          </button>
          <button className={styles.quietAction} type="button" onClick={onStay} disabled={saving}>
            Залишитись
          </button>
        </>
      }
    >
      <p className={styles.panelText}>
        {failure
          ? `${failure} Виправте це на сторінці — або вийдіть, і зміни залишаться лише на цьому пристрої.`
          : "Частина змін ще не збережена на сервері. Оберіть, що з ними зробити."}
      </p>
    </BuilderDecision>
  );
}
