import { useId, type CSSProperties, type SVGProps } from "react";

import { COMPACT, FULL } from "./markGeometry";
import styles from "./LogoMark.module.css";

/**
 * The CenterWay mark (F2). One continuous brush spiral: 2.75 counter-clockwise
 * turns, three arcs with 48° gaps, each tucking back toward the core; the
 * stroke gains weight over the first tenth of an arc and tapers to nothing over
 * the last forty percent.
 *
 * Geometry is baked — see scripts/brand-mark-bake.mjs. Surfaces that only need
 * the resting mark and cannot mount a component (the header, the landing navs)
 * paint the baked SVGs instead; this file exists for the animated states.
 *
 * Colour follows `currentColor` by default, so the mark takes the tone of
 * whatever it sits in. Pass `tone` only where the surrounding text colour is
 * not the colour the mark should be.
 */

export type LogoMarkTone = "ink" | "gold" | "current";

/**
 * none   → resting mark
 * draw   → written from the core outward, 2.4s, one pass (app load, first paint)
 * breath → turns expand and contract, 3.6s loop (empty states, practice screen)
 * wait   → turns gain density in turn, 2.1s loop (the spinner replacement)
 */
export type LogoMarkAnimation = "none" | "draw" | "breath" | "wait";

type LogoMarkProps = Omit<SVGProps<SVGSVGElement>, "children" | "width" | "height"> & {
  /** Rendered box in px. Below 24 pass `compact`; below 20 do not use the mark. */
  size?: number;
  tone?: LogoMarkTone;
  animate?: LogoMarkAnimation;
  /** The 20–24px build: two arcs, wider gaps, floored weight. */
  compact?: boolean;
  /** Accessible label. Omit where the mark sits next to the wordmark. */
  label?: string;
};

const TONE_COLOUR: Record<LogoMarkTone, string | undefined> = {
  // Not `--cw-sem-guide-strong`: "ink" means the strongest mark on THIS
  // ground, and on the night ground that is the cream, not the deep green.
  // Same value as before in the light theme.
  ink: "var(--cw-platform-ink-strong)",
  gold: "var(--cw-sem-warmth)",
  current: undefined,
};

export function LogoMark({
  size = 32,
  tone = "current",
  animate = "none",
  compact = false,
  label,
  className,
  style,
  ...rest
}: LogoMarkProps) {
  const build = compact ? COMPACT : FULL;
  // useId's value carries delimiters that are not valid inside url(#…) — strip
  // them rather than hand-rolling a counter, which would desync across SSR.
  const maskId = `cw-mark-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;

  // The compact build has no draw state: its arcs are already the short version,
  // and wiping two of them in reads as a stutter rather than a hand writing.
  const draw = animate === "draw" && !compact;
  const a11y = label ? { role: "img", "aria-label": label } : { "aria-hidden": true as const };

  const body = (
    <g
      fill="currentColor"
      className={animate === "breath" ? styles.breathBody : animate === "wait" ? styles.waitBody : undefined}
    >
      {build.arcs.map((d, i) => (
        <path key={d.slice(0, 24)} d={d} className={`${styles.arc} ${styles[`arc${i}`]}`}
          // `wait` runs the same keyframes on every arc, staggered — the offset
          // is per-index data, so it belongs here rather than in three classes.
          style={animate === "wait" ? { animationDelay: `${i * 0.26}s` } : undefined}
        />
      ))}
      <circle cx="32" cy="32" r={build.coreR} className={styles.core} />
    </g>
  );

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      focusable="false"
      className={className ? `${styles.root} ${className}` : styles.root}
      style={{ color: TONE_COLOUR[tone], ...style }}
      {...a11y}
      {...rest}
    >
      {draw ? (
        <>
          <defs>
            <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="64" height="64">
              <g className={styles.drawMask}>
                {build.mids.map((d, i) => (
                  <path
                    key={d.slice(0, 24)}
                    d={d}
                    className={`${styles.drawStroke} ${styles[`drawStroke${i}`]}`}
                    strokeDasharray={build.lens[i]}
                    strokeDashoffset={build.lens[i]}
                    style={{ "--cw-mark-len": build.lens[i] } as CSSProperties}
                  />
                ))}
                <circle cx="32" cy="32" r={build.coreR} fill="#fff" className={styles.core} />
              </g>
            </mask>
          </defs>
          <g mask={`url(#${maskId})`}>{body}</g>
        </>
      ) : (
        body
      )}
    </svg>
  );
}
