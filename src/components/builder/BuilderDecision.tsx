"use client";

/**
 * A question the author has to answer before the editor goes on.
 *
 * TWO OF THEM EXIST, and they are the same object: «you are leaving with
 * unsaved changes» and «a draft from a session that ended badly is on this
 * device». Both interrupt on purpose, both offer a small closed set of
 * answers, and neither has anything to read past the answers — so neither is a
 * `BuilderSheet`, which is a surface for a whole task with a scroller and a
 * close control.
 *
 * NATIVE `<dialog>` for the same reason the sheet uses one: focus trap,
 * inertness of the document behind it and a `::backdrop` come with the
 * element. It borrows the sheet's material (`.sheet` / `.sheetBody`) rather
 * than inventing a second plate — the builder has one raised surface and this
 * is it, narrower.
 *
 * DISMISSAL IS THE CALLER'S TO DEFINE. Leaving is dismissable, and Escape
 * means "stay", which is the safe half of that question. Recovery is not: both
 * of its answers decide the fate of real work, and an Escape that quietly
 * picks one is how a draft disappears without anybody choosing. There, Escape
 * and the backdrop do nothing and the two buttons are the only way on.
 */

import { useEffect, useId, useRef, type ReactNode } from "react";

import styles from "./Builder.module.css";

export function BuilderDecision({
  open,
  title,
  onDismiss,
  children,
  actions,
}: {
  open: boolean;
  title: string;
  /** Omitted for a forced choice: Escape and the backdrop then do nothing. */
  onDismiss?: () => void;
  children: ReactNode;
  actions: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={`${styles.sheet} ${styles.decision}`}
      aria-labelledby={titleId}
      // Escape fires `cancel` before `close`. Both are answered here so the
      // element and React never disagree about whether the question is open.
      onCancel={(event) => {
        event.preventDefault();
        onDismiss?.();
      }}
      onClose={() => onDismiss?.()}
      onClick={(event) => {
        if (event.target === ref.current) onDismiss?.();
      }}
    >
      <div className={`${styles.sheetBody} ${styles.decisionBody}`}>
        <h2 className={styles.panelTitle} id={titleId}>
          {title}
        </h2>
        {children}
        <div className={styles.decisionActions}>{actions}</div>
      </div>
    </dialog>
  );
}
