/**
 * Progress as a ring of dots — the rail's own vocabulary, bent into a circle.
 *
 * WHY BOTH EXIST. `ProgressRail` answers "how many, and how many left" for ONE
 * course, laid along the card it belongs to. It cannot answer "how do all of
 * mine stand" without taking a full card-width per course, and a dashboard that
 * needs five card-widths to say five things is not a dashboard.
 *
 * The ring is that summary: one course, one glyph, countable at 4rem. What it
 * is NOT is a filled donut — that would be the solid-bar answer ("roughly how
 * far") in a rounder shape, and the reason the rail is dashed applies exactly
 * as much here. So the marks stay marks: one dot per lesson, walked around the
 * circle, the finished ones in accent. Same seeded hand as the rail, same
 * countability, less width.
 *
 * Geometry is inline SVG rather than CSS because dots on a circle need a
 * coordinate each, and a `transform: rotate()` per dot costs a wrapper element
 * per lesson for the same picture.
 */

/** Beyond this the dots stop being countable and start being texture. */
const MAX_DOTS = 32;

/** Same seeded jitter as the rail — identical on server and client, every visit. */
function jitter(index: number, salt: number): number {
  const n = Math.sin((index + 1) * 12.9898 + salt * 78.233) * 43758.5453;
  return n - Math.floor(n);
}

type ProgressRingProps = {
  value: number;
  total: number;
  /** Accessible name — the ring carries no visible text of its own. */
  label: string;
  /** Outer box in px. The dots scale with it. */
  size?: number;
  className?: string;
};

export function ProgressRing({ value, total, label, size = 64, className }: ProgressRingProps) {
  if (total <= 0) return null;

  const done = Math.max(0, Math.min(value, total));
  const a11y = {
    role: "progressbar" as const,
    "aria-valuemin": 0,
    "aria-valuemax": total,
    "aria-valuenow": done,
    "aria-label": label,
  };

  const box = 100;
  const c = box / 2;
  const radius = 42;

  // Long courses fall back to a dashed stroke: it loses the per-dot hand — a
  // stroke pattern cannot carry one — but ninety countable dots was never the
  // offer anyway.
  if (total > MAX_DOTS) {
    const circumference = 2 * Math.PI * radius;
    const ratio = done / total;
    return (
      <svg
        className={className}
        width={size}
        height={size}
        viewBox={`0 0 ${box} ${box}`}
        {...a11y}
      >
        <circle
          cx={c}
          cy={c}
          r={radius}
          fill="none"
          stroke="var(--cw-platform-border)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray="4 6"
        />
        <circle
          cx={c}
          cy={c}
          r={radius}
          fill="none"
          stroke="var(--cw-platform-accent)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={`${circumference * ratio} ${circumference}`}
          transform={`rotate(-90 ${c} ${c})`}
        />
      </svg>
    );
  }

  return (
    <svg className={className} width={size} height={size} viewBox={`0 0 ${box} ${box}`} {...a11y}>
      {Array.from({ length: total }, (_, i) => {
        // Twelve o'clock, clockwise: the direction reading already goes.
        const angle = (i / total) * 2 * Math.PI - Math.PI / 2;
        // A hair of radius and size variance per dot, the ring's version of the
        // rail's tilt — enough to read as drawn, never enough to look misplaced.
        const r = radius + (jitter(i, 1) - 0.5) * 2.4;
        const dot = 3.1 + jitter(i, 2) * 0.9;
        return (
          <circle
            key={i}
            cx={c + Math.cos(angle) * r}
            cy={c + Math.sin(angle) * r}
            r={dot}
            fill={i < done ? "var(--cw-platform-accent)" : "var(--cw-platform-border)"}
          />
        );
      })}
    </svg>
  );
}
