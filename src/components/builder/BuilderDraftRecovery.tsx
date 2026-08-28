"use client";

/**
 * The draft that outlived the session that wrote it.
 *
 * Every keystroke is mirrored into IndexedDB before it is sent, so a tab that
 * died — a crash, a closed laptop, a phone that killed the page — leaves the
 * work behind on the device. THAT PART ALREADY WORKED. What was wrong is what
 * happened next: the editor applied the recovered draft by itself and said so
 * in a status line. The author returned to a document that silently differed
 * from the one the server had, with no way to see which was which, and the
 * single sentence explaining it disappeared on the next edit.
 *
 * A recovered draft is now a QUESTION, asked before anything is applied and
 * before autosave is allowed to run (`suspended` in `useCourseAutosave` — see
 * why there: without it, the version on screen would overwrite the very draft
 * being offered).
 *
 * TWO VARIANTS, one question. `recover` is the ordinary bad exit: the server is
 * exactly where this device left it, so restoring is simply resuming, and it
 * leads. `conflict` means the server moved on in another tab — restoring then
 * replaces somebody's saved work, so the server version leads instead and the
 * copy names what is being chosen between.
 */

import styles from "./Builder.module.css";
import { BuilderDecision } from "./BuilderDecision";

const WHEN = new Intl.DateTimeFormat("uk-UA", { dateStyle: "short", timeStyle: "short" });

export function BuilderDraftRecovery({
  open,
  variant,
  savedAt,
  onRecover,
  onDiscard,
}: {
  open: boolean;
  variant: "recover" | "conflict";
  /** When the device last mirrored a keystroke, in ms. */
  savedAt: number;
  onRecover: () => void;
  onDiscard: () => void;
}) {
  const when = WHEN.format(new Date(savedAt));
  const conflict = variant === "conflict";

  return (
    <BuilderDecision
      open={open}
      title={conflict ? "Курс змінили деінде" : "Відновити незбережені зміни?"}
      /* No dismissal: both answers decide the fate of real work, and Escape
         would be a third answer nobody chose. */
      actions={
        conflict ? (
          <>
            <button className={styles.commitAction} type="button" onClick={onDiscard}>
              Залишити серверну
            </button>
            <button className={styles.quietAction} type="button" onClick={onRecover}>
              Відновити локальну
            </button>
          </>
        ) : (
          <>
            <button className={styles.commitAction} type="button" onClick={onRecover}>
              Відновити зміни
            </button>
            <button className={styles.quietAction} type="button" onClick={onDiscard}>
              Не відновлювати
            </button>
          </>
        )
      }
    >
      <p className={styles.panelText}>
        {conflict
          ? `Серверну версію курсу оновили в іншій вкладці або на іншому пристрої. Тут лишилася локальна копія від ${when} — якщо відновити її, вона стане поточною версією замість серверної.`
          : `Минулого разу редактор закрився, не встигнувши зберегти. Зміни від ${when} збереглися на цьому пристрої.`}
      </p>
      <p className={styles.panelText}>
        {conflict
          ? "Поки ви не оберете, редактор показує серверну версію й нічого не зберігає."
          : "Якщо не відновлювати, курс залишиться таким, яким його бачить сервер, а локальна копія буде видалена."}
      </p>
    </BuilderDecision>
  );
}
