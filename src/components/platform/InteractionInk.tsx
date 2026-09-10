import type { ReactNode } from "react";

import { HandGraphic } from "@/components/Icon";

/**
 * Shared state marks for platform navigation.
 *
 * Material belongs to the surface that carries a control; hover/current state
 * belongs to the hand. Keeping the mark as real sprite geometry (instead of a
 * CSS underline or glow) lets admin, Builder and the learner shell speak the
 * same visual language without turning every label into another glass plate.
 */
export function InteractionInkLabel({
  children,
  variant = "navigation",
  active = false,
}: {
  children: ReactNode;
  /**
   * Which of the three strengths this label starts at.
   *
   * TWO MARKS, NOT THREE STRENGTHS (2026-09-09). Both are the same straight
   * rule at the same length — the word plus a small overhang — and they differ
   * in the two things a reader actually reads: WEIGHT and COLOUR.
   *
   * `navigation` / `menu` — the SELECTION stroke: thick, brass, and absent
   *   until it means something. A nav row or a tab is not announcing itself —
   *   the bar around it already says "these are the ways out" — so the mark
   *   appears on hover and stays for the row you are on. (`menu` is kept as a
   *   name because call sites and a contract test read it; it is the same
   *   mark as `navigation` and no longer a third geometry.)
   * `link` — the LINK RULE: thin, and the TEXT'S OWN COLOUR at rest, so a link
   *   in running copy carries an underline that belongs to the sentence rather
   *   than a gold line hanging under it. Pointing at it turns the rule AND the
   *   word brass together. This is what makes an ink link safe to use wherever
   *   `text-decoration` used to be.
   * `tab` — KEPT AS A NAME, not as a shape. It briefly drew a rounded-rect
   *   edge around the label, on the reasoning that a segmented control chooses
   *   one of several rather than pointing at a way out. On screen that read as
   *   a second, unrelated "selected" idiom sitting on top of the stroke — a
   *   ring around the row you last touched — and the product already answers
   *   "where am I" one way. So it resolves to the selection stroke, exactly as
   *   `menu` does, and for the same reason: call sites across the topbar,
   *   account and apps menus, the admin rail and route menu, breadcrumbs, the
   *   reader's text-size control and the Builder's rows all pass it, and a
   *   name that no longer varies the geometry is cheaper than editing them to
   *   say `navigation`.
   */
  variant?: "navigation" | "link" | "menu" | "tab";
  /** For selected text inside a compound control such as a checkbox list. */
  active?: boolean;
}) {
  return (
    <span className="cw-ink-label" data-cw-ink-variant={variant} data-cw-ink-active={active || undefined}>
      <span className="cw-ink-label-text">{children}</span>
      <HandGraphic className="cw-ink-label-mark" name="ink-rule" size={36} />
    </span>
  );
}

export function InteractionInkIcon({ children }: { children: ReactNode }) {
  return (
    <span className="cw-ink-icon">
      <span className="cw-ink-icon-glyph">{children}</span>
      <HandGraphic className="cw-ink-icon-mark" name="ink-ring" size={42} />
    </span>
  );
}
