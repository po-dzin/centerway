import styles from "./ProgressRail.module.css";

/**
 * Progress as a dashed rail — one dash per lesson, the drawn dash language the
 * icon set and the landing rails already speak, rather than a filled bar.
 *
 * A solid bar answers "roughly how far", which for an 11-lesson protocol is
 * less than the reader wants. Dashes answer "how many, and how many left" —
 * countable at a glance, and the same mark that runs under the day rhythm on
 * the landings, so progress reads as part of the route rather than a widget
 * borrowed from somewhere else.
 *
 * A WALKER STANDS ON IT. Dashes say how many are behind and how many ahead,
 * but they do not say where *you* are — the boundary between the last done
 * dash and the first undone one is a gap, and a gap is not a mark. The figure
 * is that mark: the `body` glyph from the icon set, put mid-stride and stood
 * on the edge the reader has actually reached. Before the first lesson he is
 * at the left edge, after the last at the right, otherwise on the seam between
 * the two dashes — so "which one is live" is a place on the rail rather than
 * an inference from where the gold stops.
 */

/** Beyond this the dashes stop being countable and start being texture. */
const MAX_DASHES = 32;

/**
 * Seeded, not random: the rail has to render identically on the server and the
 * client, and it has to look the same on every visit. Same principle as the
 * icon bake, which displaces its glyphs from a seeded noise field rather than
 * from Math.random.
 */
function jitter(index: number, salt: number): number {
  const n = Math.sin((index + 1) * 12.9898 + salt * 78.233) * 43758.5453;
  return n - Math.floor(n);
}

/**
 * The reader, mid-stride, facing the way the rail runs.
 *
 * Drawn to the icon contract — 24 grid, stroke 1.5, round caps, monoline, no
 * fills — and derived from `body` in scripts/lib/icon-glyphs.mjs: same head,
 * same spine, the arms and legs split into a step. Inline rather than pulled
 * from the sprite because the sprite carries the STILL figure; a walking pose
 * that only ever appears here would be one more name in a set whose whole
 * discipline is that every name earns its place.
 *
 * In ink, not accent: the gold is what the course has spent, and the reader is
 * not a unit of progress.
 */
function Walker() {
  return (
    <svg
      className={styles.walkerGlyph}
      viewBox="0 0 22 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="11" cy="4.6" r="2.1" />
      <path d="M11 6.7v6.6" />
      <path d="M7.5 11.6 11 9.4l3.7 2.4" />
      <path d="m11 13.3 3.8 3.9.6 4.2" />
      <path d="M11 13.3 7.4 18.4 6.2 21.6" />
    </svg>
  );
}

type ProgressRailProps = {
  value: number;
  total: number;
  /** Accessible name — the rail carries no visible text of its own. */
  label: string;
  className?: string;
};

export function ProgressRail({ value, total, label, className }: ProgressRailProps) {
  if (total <= 0) return null;

  const done = Math.max(0, Math.min(value, total));
  const a11y = {
    role: "progressbar" as const,
    "aria-valuemin": 0,
    "aria-valuemax": total,
    "aria-valuenow": done,
    "aria-label": label,
  };

  // Long courses fall back to a continuous dash pattern. It loses the per-dash
  // hand — a repeating gradient cannot carry one — but a 90-dash rail was never
  // going to be countable anyway, so nothing that mattered is lost.
  if (total > MAX_DASHES) {
    const ratio = done / total;
    return (
      <div className={className ? `${styles.wrap} ${className}` : styles.wrap} {...a11y}>
        <span className={styles.walker} style={{ "--cw-walk": ratio } as React.CSSProperties}>
          <Walker />
        </span>
        <span className={styles.long}>
          <span className={styles.longFill} style={{ width: `${Math.round(ratio * 100)}%` }} />
        </span>
      </div>
    );
  }

  return (
    <div className={className ? `${styles.wrap} ${className}` : styles.wrap} {...a11y}>
      {/* The seam he stands on: `done / total` is the left edge before the
          first dash, the right edge after the last, and the gap between dash
          `done` and `done + 1` everywhere in between. */}
      <span className={styles.walker} style={{ "--cw-walk": done / total } as React.CSSProperties}>
        <Walker />
      </span>
      <div className={styles.rail}>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={i < done ? styles.dashDone : styles.dash}
          style={
            {
              // ±2.6° of tilt and a little length variance per dash: enough that
              // the run reads as drawn, not printed, without any dash looking
              // like a mistake.
              "--cw-dash-tilt": `${(jitter(i, 1) - 0.5) * 5.2}deg`,
              "--cw-dash-len": `${0.86 + jitter(i, 2) * 0.14}`,
            } as React.CSSProperties
          }
        />
      ))}
      </div>
    </div>
  );
}
