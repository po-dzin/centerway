"use client";

import type { ReactNode } from "react";

import styles from "./Builder.module.css";

/**
 * A label that can be marked, and the only way a builder row says «hovered» or
 * «this is the one».
 *
 * IT REPLACES THE PLATES. Every list in the builder used to invent its own
 * highlight: a tinted fill in the outline, that same fill plus an inset
 * underline for the current lesson, a bordered card in the block palette. Two
 * problems, both reported. A hover plate and a selection plate are the same
 * object, so the moment the pointer rests on the current lesson the two states
 * are indistinguishable — the selection reads as stuck hover. And a rectangle
 * drawn around a row is a CONTOUR: it makes a list of names look like a list of
 * buttons.
 *
 * The mark is one object at two strengths instead — faint under the pointer,
 * full when the row is current — so the states cannot collapse into each other.
 *
 * IT IS A ROUNDED EDGE AROUND THE LABEL, NOT A PLATE BEHIND IT (2026-09-10).
 * The paragraph above used to end by rejecting contours outright, on the
 * grounds that a rectangle around a row makes a list of names look like a list
 * of buttons. That objection was about the PLATE — a filled rect the width of
 * the row. This edge is drawn around the label's own width and carries no
 * fill, which is why it reads as the hand marking a word rather than as a
 * button appearing under the pointer. Decided across the product, not here:
 * the bar, the trail, the tabs and the menus all mark «this is the one» this
 * way now, and a builder that kept the underline would be the one surface
 * disagreeing.
 */
export function InkLabel({
  children,
  strong = false,
  className,
}: {
  children: ReactNode;
  /** The palette's block name carries the row, so it keeps its weight. */
  strong?: boolean;
  className?: string;
}) {
  const Text = strong ? "strong" : "span";
  return (
    <span className={className ? `${styles.inkLabel} ${className}` : styles.inkLabel}>
      <Text className={styles.inkText}>{children}</Text>
      <span className={styles.inkMark} aria-hidden="true" />
    </span>
  );
}
