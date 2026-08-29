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
export function InteractionInkLabel({ children }: { children: ReactNode }) {
  return (
    <span className="cw-ink-label">
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
