/**
 * Arcs drawn by a hand, not by a compass.
 *
 * WHY THIS EXISTS. Every mark in this system is drawn: the icon sprite is baked
 * from a seeded noise field, the rail's dashes each carry their own tilt and
 * length, the landing rails wobble. The two circular meters — `ProgressRing`
 * and `DoshaWheel` — were the exception: perfect `<circle>` elements with a
 * dash array laid over them, which is the one shape a hand cannot make. Beside
 * a hand-drawn orbit and a tilted rail they read as a widget borrowed from
 * somewhere else.
 *
 * So the arcs are polylines now, sampled around the circle with a low-frequency
 * wobble on the radius and a little overshoot at each end — the same vocabulary
 * as the sprite, produced rather than baked because the number of segments is
 * data (one per lesson) and cannot be drawn ahead of time.
 *
 * SEEDED, NEVER RANDOM. The same course must draw identically on the server and
 * the client and on every visit; `jitter` is the rail's own function, kept
 * character-for-character so the two meters wobble in the same hand.
 */

/** Angles are degrees clockwise from twelve o'clock — the way reading goes. */
export type HandArcSpec = {
  cx: number;
  cy: number;
  radius: number;
  fromDeg: number;
  toDeg: number;
  /** Any integer: two arcs with the same seed wobble identically. */
  seed: number;
  /** Peak radial deviation, in the same units as `radius`. */
  amplitude?: number;
};

/**
 * Seeded, not random — same principle and same constants as `ProgressRail`.
 * Returns 0..1.
 */
export function jitter(index: number, salt: number): number {
  const n = Math.sin((index + 1) * 12.9898 + salt * 78.233) * 43758.5453;
  return n - Math.floor(n);
}

/** Degrees between sampled points. Small enough that no chord shows at 4rem. */
const STEP_DEG = 3;

export function handArcPath({ cx, cy, radius, fromDeg, toDeg, seed, amplitude = 1.1 }: HandArcSpec): string {
  /* THE OVERSHOOT IS THE HAND. A drawn stroke starts a little before and stops
     a little after where it was meant to; without it the segments end on a
     machined boundary and the wobble reads as a rendering artefact rather than
     as a mark. Kept under a degree so a gap never closes. */
  const start = fromDeg - jitter(seed, 3) * 0.7;
  const end = toDeg + jitter(seed, 4) * 0.7;
  const span = end - start;
  const steps = Math.max(2, Math.round(Math.abs(span) / STEP_DEG));

  /* Two slow sines rather than per-point noise: noise gives a jagged edge, and
     a hand wanders. The phases come off the seed, so each segment of a ring
     wanders differently while staying smooth in itself. */
  const phaseA = jitter(seed, 1) * Math.PI * 2;
  const phaseB = jitter(seed, 2) * Math.PI * 2;

  const points: string[] = [];
  for (let i = 0; i <= steps; i += 1) {
    const deg = start + (span * i) / steps;
    const rad = (deg * Math.PI) / 180;
    const wobble =
      amplitude * (Math.sin(rad * 2.7 + phaseA) * 0.62 + Math.sin(rad * 6.1 + phaseB) * 0.38);
    const r = radius + wobble;
    const x = cx + Math.sin(rad) * r;
    const y = cy - Math.cos(rad) * r;
    points.push(`${x.toFixed(2)} ${y.toFixed(2)}`);
  }

  return `M${points[0]}L${points.slice(1).join("L")}`;
}
