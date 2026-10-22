"use client";

/**
 * The sphere map as a radar: seven axes, three shapes.
 *
 *   зараз      A, filled — the one shape that is the person's present, so it
 *              is the only one with a ground (the embodied hue at a wash).
 *   через рік  B, a dashed muted outline — a direction, not a thing yet.
 *   на старті  the first snapshot of A, a thin line in the border colour —
 *              there to be compared against, never to compete.
 *
 * Every colour is a token, read in `SphereMap.module.css`; this file only
 * draws geometry. The radar is a picture of the list beside it, so it is one
 * `role="img"` with a text alternative, not seven focusable things — the list
 * is where the numbers are read and changed.
 */

import { useId } from "react";

import {
  SPHERE_AXIS_IDS,
  SPHERE_SCORE_MAX,
  radarPoints,
  radarPolygon,
  type SphereAxisId,
  type SphereMap,
  type SphereSnapshot,
} from "@/lib/profile/sphereMap";

import styles from "./SphereMap.module.css";

const BOX = 280;
const CENTRE = BOX / 2;
const RADIUS = 84;
const LABEL_RADIUS = 98;
const RINGS = [2, 4, 6, 8, 10];

export function SphereRadar({
  map,
  start,
  labels,
  title,
  compact = false,
}: {
  map: SphereMap;
  /** The snapshot to draw as «на старті»; none until there are two. */
  start?: SphereSnapshot | null;
  labels?: Record<SphereAxisId, string>;
  title: string;
  /** The dashboard card's thumbnail: no axis labels. */
  compact?: boolean;
}) {
  const titleId = useId();
  const geometry = { cx: CENTRE, cy: CENTRE, radius: RADIUS };
  const now = SPHERE_AXIS_IDS.map((id) => map.spheres[id]?.now ?? null);
  const goal = SPHERE_AXIS_IDS.map((id) => map.spheres[id]?.goal ?? null);
  const hasNow = now.some((value) => value !== null);
  const hasGoal = goal.some((value) => value !== null);
  const outer = radarPoints(
    SPHERE_AXIS_IDS.map(() => SPHERE_SCORE_MAX),
    geometry,
  );
  const labelPoints = radarPoints(
    SPHERE_AXIS_IDS.map(() => SPHERE_SCORE_MAX),
    { ...geometry, radius: LABEL_RADIUS },
  );

  /* Labels leave room around the circle; the thumbnail has none and is cropped
     to the rings. */
  const pad = compact ? CENTRE - RADIUS - 4 : 0;
  const viewBox = `${pad} ${pad} ${BOX - pad * 2} ${BOX - pad * 2}`;

  return (
    <svg
      className={compact ? styles.radarCompact : styles.radar}
      viewBox={viewBox}
      role="img"
      aria-labelledby={titleId}
    >
      <title id={titleId}>{title}</title>

      {RINGS.map((ring) => (
        <polygon
          key={ring}
          className={styles.radarRing}
          points={radarPolygon(
            radarPoints(
              SPHERE_AXIS_IDS.map(() => ring),
              geometry,
            ),
          )}
        />
      ))}
      {outer.map((point, index) => (
        <line
          key={SPHERE_AXIS_IDS[index]}
          className={styles.radarSpoke}
          x1={CENTRE}
          y1={CENTRE}
          x2={point.x}
          y2={point.y}
        />
      ))}

      {start ? (
        <polygon
          className={styles.radarStart}
          points={radarPolygon(
            radarPoints(
              SPHERE_AXIS_IDS.map((id) => start.now[id] ?? null),
              geometry,
            ),
          )}
        />
      ) : null}
      {hasGoal ? <polygon className={styles.radarGoal} points={radarPolygon(radarPoints(goal, geometry))} /> : null}
      {hasNow ? <polygon className={styles.radarNow} points={radarPolygon(radarPoints(now, geometry))} /> : null}

      {!compact && labels
        ? labelPoints.map((point, index) => {
            const id = SPHERE_AXIS_IDS[index]!;
            const anchor = Math.abs(point.x - CENTRE) < 4 ? "middle" : point.x > CENTRE ? "start" : "end";
            return (
              <text
                key={id}
                className={styles.radarLabel}
                x={point.x}
                y={point.y}
                textAnchor={anchor}
                dominantBaseline="middle"
              >
                {labels[id]}
              </text>
            );
          })
        : null}
    </svg>
  );
}
