"use client";

/**
 * A checkbox in the system pattern (2026-10-22).
 *
 * The same row the catalogue and shelf filters use: the native input stays in
 * the tree for the keyboard and the screen reader but is not painted; a box
 * with the check glyph is, and the chosen label takes the account menu's ink.
 * The admin had bare browser checkboxes — inside a dialog portalled out of the
 * admin theme, so they were not even the theme's colour — which is the "local
 * toggle" docs/design-system.md asks not to invent.
 *
 * selection_family: `hybrid` — the box is the semantic signal (contour), the
 * chosen label carries the canonical menu ink, bounded to its own words. A
 * long label (a sentence of explanation) wraps and carries no ink.
 */

import type { ReactNode } from "react";

import { Icon } from "@/components/Icon";
import { InteractionInkLabel } from "@/components/platform/InteractionInk";
import styles from "./AdminChoice.module.css";

export function AdminChoice({
  checked,
  onChange,
  children,
  long = false,
  disabled = false,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
  /** A sentence rather than a word: wraps under its first line, no ink. */
  long?: boolean;
  disabled?: boolean;
}) {
  return (
    <label className={styles.choice} data-long={long || undefined} data-disabled={disabled || undefined}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span className={styles.box} aria-hidden="true">
        <Icon name="check" size={14} />
      </span>
      {long ? (
        <span className={styles.longLabel}>{children}</span>
      ) : (
        <InteractionInkLabel variant="menu" active={checked}>
          {children}
        </InteractionInkLabel>
      )}
    </label>
  );
}
