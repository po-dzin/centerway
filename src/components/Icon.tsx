import type { SVGProps } from "react";

import { CW_SPRITE_VERSION, type CwGraphicName, type CwIconName } from "./iconNames";

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

/* THE VERSION IS THE POINT, NOT DECORATION. The sprite is cached for a week
   (next.config.ts) and referenced by id, so a week-old copy cannot answer for
   ids added since — a `<use>` whose target is missing paints nothing at all,
   silently. `CW_SPRITE_VERSION` is the baked file's own content hash, so a
   redrawn or extended sprite is a different URL and reaches everyone on their
   next page view instead of whenever their week happens to run out. */
const SPRITE = `/cw/icons/cw-icons.svg?v=${CW_SPRITE_VERSION}`;

type IconBaseProps = Omit<SVGProps<SVGSVGElement>, "children" | "width" | "height"> & {
  /** Rendered box in px. Do not go below 20 — the hand starts eating counters. */
  size?: number;
  /** Accessible label. Omit for decorative icons; they get aria-hidden instead. */
  label?: string;
};

function Glyph({
  id,
  size,
  label,
  viewBox,
  stretch = false,
  ...rest
}: IconBaseProps & { id: string; viewBox?: string; stretch?: boolean }) {
  const a11y = label ? { role: "img", "aria-label": label } : { "aria-hidden": true as const };
  return (
    <svg
      width={size}
      height={size}
      viewBox={viewBox}
      preserveAspectRatio={stretch ? "none" : undefined}
      focusable="false"
      {...a11y}
      {...rest}
    >
      <use href={`${SPRITE}#${id}`} width={stretch ? "100%" : undefined} height={stretch ? "100%" : undefined} />
    </svg>
  );
}

export function Icon({ name, size = 24, ...rest }: IconBaseProps & { name: CwIconName }) {
  return <Glyph id={`cw-${name}`} size={size} viewBox="0 0 24 24" {...rest} />;
}

/**
 * The dot / path / orbit layer. Same sprite, 36 grid. This is navigation
 * between blocks, not decoration: never place it inside a text column.
 */
export function HandGraphic({ name, size = 72, ...rest }: IconBaseProps & { name: CwGraphicName }) {
  return (
    <Glyph
      id={`cw-${name}`}
      size={size}
      viewBox="0 0 36 36"
      stretch={name === "ink-stroke" || name === "ink-rule"}
      {...rest}
    />
  );
}
