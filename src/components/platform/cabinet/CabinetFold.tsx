"use client";

/**
 * A dashboard section that is folded shut on a phone and open from tablet up.
 *
 * WHY IT EXISTS. The dashboard answers "what do I open right now" in its first
 * screen, and then keeps going: every purchase ever made, every contact field,
 * the install card. On a desktop those sit two-up in a grid and cost a glance.
 * On a phone the grid is one column, so the same content became a ribbon the
 * reader had to scroll past to reach the end of their own account — reference
 * material charging rent on the answer above it.
 *
 * `<details>` rather than a hand-rolled toggle: the disclosure semantics, the
 * keyboard behaviour and find-in-page revealing a closed section are all free,
 * and none of them are free when a `<div>` and `aria-expanded` do it.
 *
 * The breakpoint is read through `useSyncExternalStore`, not an effect. The
 * store's client snapshot is available on the FIRST client render, so React
 * settles the open state during hydration, before paint — an effect would ship
 * the phone's closed state to a desktop and then open it a frame later, which
 * is a visible jump on the widest screens where nothing was wrong.
 */

import { useSyncExternalStore, type ReactNode } from "react";

import { Icon } from "@/components/Icon";
import styles from "./Cabinet.module.css";

/* The platform's tablet boundary, the same number `Cabinet.module.css` opens
   the two-column grid on. Two copies of one breakpoint is how a section comes
   to be folded shut in a layout that already has room for it. */
const WIDE = "(min-width: 561px)";

function subscribe(onChange: () => void) {
  const query = window.matchMedia(WIDE);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function useIsWide() {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(WIDE).matches,
    /* The server has no viewport, so it renders the phone: folded shut is the
       state that is wrong in the cheaper direction. */
    () => false,
  );
}

export function CabinetFold({
  label,
  title,
  lead,
  children,
}: {
  label: string;
  title: string;
  lead?: string;
  children: ReactNode;
}) {
  const wide = useIsWide();

  return (
    /* `open` is set, not controlled: React writes the attribute on mount and on
       a breakpoint change, and leaves the reader's own toggling alone in
       between. A controlled `<details>` would slam shut under anyone who opened
       a section on a phone and then scrolled, since the next render would
       reassert the media query's answer. */
    <details className={styles.fold} open={wide}>
      <summary className={styles.foldHead}>
        <span className={styles.foldText}>
          <span className={styles.sectionLabel}>{label}</span>
          <h2 className={styles.sectionTitle}>{title}</h2>
          {lead ? <span className={styles.sectionLead}>{lead}</span> : null}
        </span>
        <Icon className={styles.foldChevron} name="chevron-down" size={20} />
      </summary>
      <div className={styles.foldBody}>{children}</div>
    </details>
  );
}
