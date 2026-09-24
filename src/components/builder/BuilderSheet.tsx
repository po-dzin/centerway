"use client";

/**
 * A sheet for one whole task — today, the course's version history.
 *
 * NATIVE `<dialog>`, on purpose. It brings Escape, an element that knows
 * whether it is open, and — when opened modally — a focus trap, inertness of
 * the page behind it and a `::backdrop` to style. Four things a hand-rolled
 * overlay gets wrong in four different ways, and the design system's own rule
 * is to prefer the platform control and customise only the surface.
 *
 * WHY THIS EARNS A SHEET AT ALL. A panel in the page is right for something you
 * read on the way past. This is the opposite: entered deliberately, used rarely,
 * and irrelevant to the reason an author opened the course — in the flow it cost
 * every visit a scroll past it to reach the lesson list.
 *
 * TWO PLACEMENTS, AND THEY ARE TWO DIFFERENT OBJECTS.
 *
 * `center` is a sheet: one thing at a time, the page behind it is not the point
 * while it is open, and `showModal()` is exactly right for it.
 *
 * `side` is a DRAWER on a desk — the version history opened BESIDE the work to
 * look something up. `showModal()` made it a modal wearing a drawer's shape:
 * the document next to it could not be scrolled, clicked or read from, which is
 * the one thing an author opens a history for. So above 561px it opens
 * non-modally (`show()`): the panel is on screen, the course is still live
 * under the hand, and closing is a press on the × or Escape. Below 561px the
 * same placement is a bottom sheet covering the phone's whole screen, where
 * there is no «beside» to preserve and the focus trap is worth having — so
 * there it stays modal.
 *
 * ESCAPE IS THE ONE THING `show()` DOES NOT BRING. A non-modal dialog receives
 * no `cancel` event, so the key is listened for here, and only while open.
 */

import { useEffect, useRef, type ReactNode } from "react";

import { Icon } from "@/components/Icon";
import styles from "./Builder.module.css";

/** The width at which `side` stops being a bottom sheet and becomes a drawer. */
const DRAWER_FROM = "(min-width: 561px)";

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
    if (!open) {
      if (dialog.open) dialog.close();
      return;
    }

    /* Which of the two it is, asked at the moment of opening rather than
       rendered from state: this is a property of the viewport, not of the
       component's props, and a media query read in JavaScript that nothing
       re-renders on cannot go stale while the dialog is shut. A resize across
       the breakpoint with the panel open is handled below. */
    const drawer = placement === "side" && window.matchMedia(DRAWER_FROM).matches;

    const show = () => {
      if (dialog.open) dialog.close();
      if (drawer) dialog.show();
      else dialog.showModal();
    };
    if (!dialog.open) show();

    /* Crossing 561px flips the object: a modal bottom sheet becomes a drawer
       beside the work and vice versa. Re-opening in the other mode is the only
       way to change it — `showModal()` and `show()` are separate entry points,
       not a flag. */
    const media = window.matchMedia(DRAWER_FROM);
    const onBreakpoint = () => {
      if (placement !== "side") return;
      show();
    };
    media.addEventListener("change", onBreakpoint);

    /* Escape, for the non-modal half. The modal half gets `cancel` from the
       platform and must not also receive this one, or a single press would be
       handled twice. */
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (!ref.current?.open || ref.current.matches(":modal")) return;
      event.preventDefault();
      onClose();
    };
    document.addEventListener("keydown", onKeyDown);

    return () => {
      media.removeEventListener("change", onBreakpoint);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, placement, onClose]);

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
      // A non-modal drawer has no backdrop to click and no page to shield — the
      // click simply reaches the course, which is the whole point of it.
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
