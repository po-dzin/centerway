"use client";

import { Icon } from "@/components/Icon";

import styles from "./Builder.module.css";
import type { DragRef, RowDrag } from "./useRowDrag";

/**
 * The place a row is picked up by.
 *
 * A `span`, not a button: it does nothing on click, and a button that does
 * nothing on click is a promise the row cannot keep. Reordering from the
 * keyboard is the menu's «Підняти вище» / «Опустити нижче», which is also the
 * only way to do it on a touch screen — the grip is not rendered there at all
 * (see `.rowGrip` in the stylesheet).
 */
export function BuilderGrip({ drag, row, label }: { drag: RowDrag; row: DragRef; label: string }) {
  return (
    <span className={styles.rowGrip} title={`Перетягніть, щоб переставити: ${label}`} aria-hidden="true" {...drag.handleProps(row)}>
      <Icon name="grip" size={16} />
    </span>
  );
}
