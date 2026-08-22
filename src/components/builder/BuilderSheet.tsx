"use client";

/**
 * A sheet for one whole task — today, the course's settings.
 *
 * NATIVE `<dialog>`, on purpose. `showModal()` brings a focus trap, Escape,
 * inertness of the page behind it and a `::backdrop` to style — four things a
 * hand-rolled overlay gets wrong in four different ways, and the design system's
 * own rule is to prefer the platform control and customise only the surface.
 *
 * WHY SETTINGS EARN A SHEET AT ALL. They used to be a panel in the page, and a
 * panel is right for something you read on the way past. Settings are the
 * opposite: entered deliberately, changed rarely, and irrelevant to the reason
 * an author opened the course. In the flow they cost every visit a scroll past
 * the entitlement codes to reach the lesson list.
 *
 * It rises from the bottom on a phone and sits centred on a desk, because the
 * thumb is at the bottom and the eye is in the middle.
 */

import { useEffect, useRef, type ReactNode } from "react";

import { Icon } from "@/components/Icon";
import styles from "./Builder.module.css";

export function BuilderSheet({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
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
      className={styles.sheet}
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
