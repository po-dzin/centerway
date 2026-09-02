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
   * `navigation` — invisible at rest. A nav row or a tab is not announcing
   *   itself: the bar around it already says "these are the ways out", and a
   *   permanent mark under every item would make the current one unreadable.
   * `link` — VISIBLE AT REST. A text link inside a paragraph or a block head
   *   has no such frame, so it has to carry its own affordance; browsers solve
   *   this with `text-decoration` and we solve it with the same stroke the rest
   *   of the system uses, one strength quieter. This is what makes an ink link
   *   safe to use where the default underline used to be.
   * `menu` — the established thick stroke used by the account menu.
   */
  variant?: "navigation" | "link" | "menu";
  /** For selected text inside a compound control such as a checkbox list. */
  active?: boolean;
}) {
  return (
    <span className="cw-ink-label" data-cw-ink-variant={variant} data-cw-ink-active={active || undefined}>
      <span className="cw-ink-label-text">{children}</span>
      <HandGraphic className="cw-ink-label-mark" name="ink-stroke" size={36} />
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
