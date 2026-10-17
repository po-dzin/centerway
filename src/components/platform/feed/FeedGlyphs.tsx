/**
 * Two glyphs the action row needs and the DS sprite does not have yet: a
 * speech bubble (comments) and a face (react, when a post has no reactions).
 *
 * Drawn as in the approved mockup (heromock, 17.10), on the sprite's 24 grid
 * with its 1.5 stroke and round joins, so they stand beside `Icon` without a
 * seam. They belong in scripts/lib/icon-glyphs.mjs as `comment` and `smile`
 * (baked with the hand wobble); until that lands they live here, and nowhere
 * else draws them.
 */

const STROKE = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

export function CommentGlyph() {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        {...STROKE}
        d="M20 11.5c0 4-3.6 7-8 7-1.2 0-2.3-.2-3.3-.6L4 19l1.3-3.6C4.5 14.2 4 12.9 4 11.5c0-4 3.6-7 8-7s8 3 8 7z"
      />
    </svg>
  );
}

export function SmileGlyph() {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <g {...STROKE}>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M8.5 14c.9 1.3 2.1 2 3.5 2s2.6-.7 3.5-2M9 9.5h.01M15 9.5h.01" />
      </g>
    </svg>
  );
}
