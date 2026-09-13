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
 * The mark is one object at two strengths instead — faint under the pointer,
 * full when the row is current — so the states cannot collapse into each other.
 *
 * IT IS THE PLATFORM'S STROKE, NOT A LOCAL DRAWING (2026-09-11). For one day
 * this module drew a rounded ink edge around the label instead — a border and a
 * radius, in place of the stroke's five geometry values. The platform had tried
 * the same shape, under the name `tab`, and took it back out the same week: on
 * screen it read as a second, unrelated "selected" idiom sitting on top of the
 * stroke, a ring around the row you last touched. The builder's copy did not
 * come out with it, and shipped. That is what this reverts.
 *
 * There is no builder recipe any more, which is the point. The mark is
 * `InteractionInk`'s baked `ink-rule` graphic, positioned and timed by the same
 * `--cw-ink-*` tokens as the topbar, the trail, the account menu and the admin
 * rail. A surface cannot drift from a contract it does not hold a copy of.
 *
 * The builder's own classes stay on the wrapper because layout rules in
 * `Builder.module.css` reach for them: a compact rail hides `.inkLabel`, a rail
 * row pads it. Those say where the label sits, not what the mark looks like.
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
    <span className={`cw-ink-label ${styles.inkLabel}${className ? ` ${className}` : ""}`} data-cw-ink-variant="tab">
      <Text className={`cw-ink-label-text ${styles.inkText}`}>{children}</Text>
      <HandGraphic className="cw-ink-label-mark" name="ink-rule" size={36} />
    </span>
  );
}
