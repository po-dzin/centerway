/**
 * Progress as a ring of dashes — the rail's own vocabulary, bent into a circle.
 *
 * WHY BOTH EXIST. `ProgressRail` answers "how many, and how many left" for ONE
 * course, laid along the card it belongs to. It cannot answer "how do all of
 * mine stand" without taking a full card-width per course, and a dashboard that
 * needs five card-widths to say five things is not a dashboard.
 *
 * The ring is that summary: one course, one glyph, countable at 48px.
 *
 * DASHES, NOT DOTS (2026-08-28). The first version walked one dot per lesson
 * around the circle. Countable, but at dashboard size it read as a scatter of
 * beads rather than as a measure — nothing joined them, so "how far round am I"
 * had to be assembled dot by dot. The marks are ARCS now: each lesson owns its
 * own slice of the circumference, cut by a gap wide enough to see, and the
 * accent runs exactly as far as the lessons that are done. A dashed circle, not
 * a filled one — the gap is what keeps every lesson its own countable unit,
 * which is the same reason the rail is dashed.
 *
 * DRAWN, NOT STRUCK (2026-08-28). The first dashed version was a `<circle>`
 * with a dash array on it — machined, beside a hand-drawn orbit and a rail
 * whose every dash carries its own tilt. Each segment is a sampled polyline
 * with a wobbling radius now (see `handArc.ts`), in the same hand as the icon
 * sprite: round caps, one stroke weight, no fills.
 */

import { handArcPath, jitter } from "./handArc";

/**
 * Beyond this the segments stop being countable and start being texture — and,
 * concretely, a step gets narrower than the `stroke + 2` of circumference the
 * gap needs, so the marks would close up into a band.
 */
const MAX_SEGMENTS = 24;

type ProgressRingProps = {
  value: number;
  total: number;
  /** Accessible name — the ring carries no visible text of its own. */
  label: string;
  /** Outer box in px. The stroke scales with it. */
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
  const radius = 43;
  /* THIN ENOUGH THAT THE GAPS SURVIVE. At stroke 9 the round caps — half a
     stroke of overshoot at each end — met across every gap, and a twenty-one
     lesson ring came out as a fat band with a bulge at each seam. Seven is the
     rail's own weight relative to its dash: heavy enough to read at 48px, light
     enough that the break between two marks survives. */
  const stroke = 7;

  // Long courses fall back to two continuous arcs. Past `MAX_SEGMENTS` a step
  // is narrower than the gap the marks need to stay apart, so the dashes would
  // merge back into the band this ring exists to refuse — and twenty-five
  // countable marks in a 48px glyph was never the offer anyway. Drawn by the
  // same hand, so the fallback is the same object with its marks joined up.
  if (total > MAX_SEGMENTS) {
    const sweep = (done / total) * 360;
    return (
      <svg className={className} width={size} height={size} viewBox={`0 0 ${box} ${box}`} {...a11y}>
        <g fill="none" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
          <path
            d={handArcPath({ cx: c, cy: c, radius, fromDeg: 0, toDeg: 360, seed: 1 })}
            stroke="var(--cw-platform-border)"
          />
          {sweep > 0 ? (
            <path
              d={handArcPath({ cx: c, cy: c, radius, fromDeg: 0, toDeg: sweep, seed: 2 })}
              stroke="var(--cw-platform-accent)"
            />
          ) : null}
        </g>
      </svg>
    );
  }

  const stepDeg = 360 / total;
  /* THE GAP IS A LENGTH, NOT AN ANGLE. A fixed angle is a different amount of
     ink at four lessons and at twenty-one, and the thing it has to clear is the
     stroke: a round cap overshoots by half a stroke at each end, so a gap
     narrower than the stroke closes and the marks merge. Two units of daylight
     past that, and never more than 42% of a step — at which point the ring
     would stop being almost whole. */
  const circumference = 2 * Math.PI * radius;
  const gapDeg = Math.min(((stroke + 2) / circumference) * 360, stepDeg * 0.42);

  return (
    // Twelve o'clock, clockwise: the direction reading already goes.
    <svg className={className} width={size} height={size} viewBox={`0 0 ${box} ${box}`} {...a11y}>
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        {Array.from({ length: total }, (_, i) => (
          <path
            key={i}
            d={handArcPath({
              cx: c,
              cy: c,
              radius,
              fromDeg: i * stepDeg + gapDeg / 2,
              toDeg: (i + 1) * stepDeg - gapDeg / 2,
              seed: i + 1,
            })}
            stroke={i < done ? "var(--cw-platform-accent)" : "var(--cw-platform-border)"}
            /* A hair of weight variance per segment — the pressure of a hand,
               the ring's version of the rail's tilt. */
            strokeWidth={stroke * (0.9 + jitter(i, 5) * 0.2)}
          />
        ))}
      </g>
    </svg>
  );
}
