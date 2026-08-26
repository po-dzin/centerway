"use client";

import type { ReactNode } from "react";

import { HandGraphic } from "@/components/Icon";
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
 * The stroke is one object at two strengths instead — faint under the pointer,
 * full when the row is current — so the states cannot collapse into each other,
 * and it is the hand's own ink rather than a frame. The trail and the course
 * rail already spoke this way; this is the rest of the builder joining them.
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
      <HandGraphic className={styles.inkMark} name="ink-stroke" size={36} />
    </span>
  );
}
