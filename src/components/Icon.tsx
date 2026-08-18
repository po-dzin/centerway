import type { SVGProps } from "react";

import type { CwGraphicName, CwIconName } from "./iconNames";

/**
 * The one icon primitive. Renders a `<use>` reference into the baked sprite
 * (public/cw/icons/cw-icons.svg) — the wobble is already in the geometry, so
 * nothing here costs a filter pass.
 *
 * Colour: the glyph inherits `currentColor`. Accent dots read
 * `--cw-icon-accent`, which falls back to `currentColor` when unset — set it on
 * an ancestor (usually to `--cw-sem-warmth`) when a dot should carry the accent.
 *
 * Static landings use the same sprite directly from `/shared/img/cw-icons.svg`;
 * funnel hosts cannot see `/cw/**`.
 */

const SPRITE = "/cw/icons/cw-icons.svg";

type IconBaseProps = Omit<SVGProps<SVGSVGElement>, "children" | "width" | "height"> & {
  /** Rendered box in px. Do not go below 20 — the hand starts eating counters. */
  size?: number;
  /** Accessible label. Omit for decorative icons; they get aria-hidden instead. */
  label?: string;
};

function Glyph({ id, size, label, ...rest }: IconBaseProps & { id: string }) {
  const a11y = label ? { role: "img", "aria-label": label } : { "aria-hidden": true as const };
  return (
    <svg width={size} height={size} focusable="false" {...a11y} {...rest}>
      <use href={`${SPRITE}#${id}`} />
    </svg>
  );
}

export function Icon({ name, size = 24, ...rest }: IconBaseProps & { name: CwIconName }) {
  return <Glyph id={`cw-${name}`} size={size} {...rest} />;
}

/**
 * The dot / path / orbit layer. Same sprite, 36 grid. This is navigation
 * between blocks, not decoration: never place it inside a text column.
 */
export function HandGraphic({
  name,
  size = 72,
  ...rest
}: IconBaseProps & { name: CwGraphicName }) {
  return <Glyph id={`cw-${name}`} size={size} {...rest} />;
}
