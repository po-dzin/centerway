"use client";

/**
 * A sheet for one whole task — today, the course's version history.
 *
 * NATIVE `<dialog>`, on purpose. `showModal()` brings a focus trap, Escape,
 * inertness of the page behind it and a `::backdrop` to style — four things a
 * hand-rolled overlay gets wrong in four different ways, and the design system's
 * own rule is to prefer the platform control and customise only the surface.
 *
 * WHY THIS EARNS A SHEET AT ALL. A panel in the page is right for something you
 * read on the way past. This is the opposite: entered deliberately, used rarely,
 * and irrelevant to the reason an author opened the course — in the flow it cost
 * every visit a scroll past it to reach the lesson list.
 *
 * TWO PLACEMENTS, and the difference is only where the surface lives. Both rise
 * from the bottom on a phone, because the thumb is there. On a desk `center`
 * sits in the middle, where the eye is, and `side` becomes a right drawer flush
 * with the viewport edge — the same object as the builder's tool layer, so it
 * carries that panel's ground and drawn rule rather than a floating plate's
 * radius and shadow.
 */

import { useEffect, useRef, type ReactNode } from "react";

import { Icon } from "@/components/Icon";
import styles from "./Builder.module.css";

export function BuilderSheet({
  open,
  title,
  placement = "center",
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  placement?: "center" | "side";
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={`${styles.sheet} ${placement === "side" ? styles.sheetSide : ""}`}
      aria-label={title}
      // Escape fires `cancel` before `close`; both are routed back to the owner
      // so React state and the element never disagree about whether it is open.
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClose={onClose}
      // Clicking the backdrop dismisses. The dialog's own box is the only child,
      // so a click that lands on the element itself landed outside the content.
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
    >
      <div className={styles.sheetBody}>
        <div className={styles.sheetHead}>
          <h2 className={styles.panelTitle}>{title}</h2>
          <button className={styles.menuTrigger} type="button" aria-label="Закрити" onClick={onClose}>
            <Icon name="close" size={18} />
          </button>
        </div>
        <div className={styles.sheetScroll}>{children}</div>
      </div>
    </dialog>
  );
}
