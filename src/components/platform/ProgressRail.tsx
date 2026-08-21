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
      <div className={className ? `${styles.long} ${className}` : styles.long} {...a11y}>
        <span className={styles.longFill} style={{ width: `${Math.round(ratio * 100)}%` }} />
      </div>
    );
  }

  return (
    <div className={className ? `${styles.rail} ${className}` : styles.rail} {...a11y}>
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
  );
}
