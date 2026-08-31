"use client";

/**
 * A secondary dashboard section, folded shut by default.
 *
 * WHY IT EXISTS. The dashboard answers "what do I open right now" in its first
 * screen, and then keeps going: every purchase ever made, every contact field,
 * the install card. They remain reference material on every viewport, rather
 * than charging vertical space beneath the dashboard's primary answer.
 *
 * `<details>` rather than a hand-rolled toggle: the disclosure semantics, the
 * keyboard behaviour and find-in-page revealing a closed section are all free,
 * and none of them are free when a `<div>` and `aria-expanded` do it.
 */

import type { ReactNode } from "react";

import { Icon } from "@/components/Icon";
import styles from "./Cabinet.module.css";

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
  return (
    /* Personal data and receipts are reference material at every viewport.
       Keep the reader's deliberate opening intact; a controlled disclosure
       would shut again whenever any unrelated cabinet data refreshed. */
    <details className={styles.fold}>
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
