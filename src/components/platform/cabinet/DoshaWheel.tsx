"use client";

/**
 * The dosha result as one wheel instead of three bars.
 *
 * WHY IT CHANGED. Three horizontal meters cost a full card each time they were
 * drawn, and the row of them said the same thing the result line above already
 * said in words — this person is Vata-Pitta. A dashboard's job with a finished
 * test is to show the SHAPE at a glance and keep the numbers for whoever asks.
 *
 * The wheel is that shape: one ring, three arcs sized by score, each in its own
 * dosha colour, with the result type under it and the three numbers printed
 * below that. The numbers used to arrive on hover, on the argument that the
 * shape is the answer and the figures are for whoever asks; on a tile with room
 * under the wheel that argument buys nothing and costs a pointer — a touch
 * screen has no hover, and a result you have to discover is a result the
 * dashboard did not give you.
 *
 * NOT A PIE. The arcs sit on one circle with a gap between them, so the picture
 * is a ring divided rather than a solid disc: the platform's marks are drawn,
 * never filled (see the rail and the progress ring).
 *
 * DRAWN, NOT STRUCK (2026-08-28). The arcs were `<circle>` elements with a dash
 * array laid on them — machined, on a screen where the orbit on the photograph
 * and the rail on the card beside it are both hand-drawn. They are polylines
 * with a wandering radius now, from the same `handArc` the progress ring uses,
 * so the two circular meters on this screen come off one hand.
 */

import { useId } from "react";

import { handArcPath } from "@/components/platform/handArc";

import type { ProfileLang } from "@/components/platform/profile/types";
import styles from "./Cabinet.module.css";

/* Every field is nullable because the API's is: an unfinished or partial test
   can carry a type with a score missing, and the wheel treats a missing score
   as zero rather than refusing to draw. */
export type DoshaScores = { vata: number | null; pitta: number | null; kapha: number | null };

const ORDER = ["vata", "pitta", "kapha"] as const;
type DoshaKey = (typeof ORDER)[number];

/** The ring's own geometry, in SVG units. One place, so the arcs agree. */
const BOX = 120;
const RADIUS = 48;
const STROKE = 7;
/** Degrees of empty ring between two arcs — what makes it read as divided.
    Wide enough to clear the round caps: they overshoot by half a stroke each,
    so at the old 6° the three arcs met and the wheel read as one band. */
const GAP = 13;

export function DoshaWheel({
  scores,
  labels,
  resultLabel,
  lang,
}: {
  scores: DoshaScores;
  labels: Record<DoshaKey, string>;
  /** The type, printed in the middle — «Вата-Пітта». */
  resultLabel: string;
  lang: ProfileLang;
}) {
  const titleId = useId();
  const total = ORDER.reduce((sum, key) => sum + Math.max(0, scores[key] ?? 0), 0);

  // Nothing to divide: a wheel of one arc is a circle, and a circle here would
  // claim a shape the test did not produce.
  if (total <= 0) return null;

  /* Each arc starts where the shares before it end. Written as a fold rather
     than a `let` walked through `.map` — the lint rule that forbids reassigning
     after render is right on principle here: a running cursor in a render body
     is state pretending to be a local. */
  const arcs = ORDER.reduce<Array<{ key: DoshaKey; share: number; fromDeg: number; toDeg: number }>>(
    (acc, key) => {
      const before = acc.reduce((sum, item) => sum + item.share, 0);
      const share = Math.max(0, scores[key] ?? 0) / total;
      const fromDeg = before * 360 + GAP / 2;
      const toDeg = (before + share) * 360 - GAP / 2;
      return [...acc, { key, share, fromDeg, toDeg }];
    },
    [],
  ).filter((arc) => arc.toDeg > arc.fromDeg);

  return (
    <div className={styles.wheel}>
      <svg
        className={styles.wheelRing}
        viewBox={`0 0 ${BOX} ${BOX}`}
        role="img"
        aria-labelledby={titleId}
      >
        <title id={titleId}>
          {lang === "en" ? "Dosha balance" : "Баланс дош"}: {resultLabel}
        </title>
        {/* The unlit ring the arcs are drawn on — without it a low score reads
            as a missing piece rather than as a smaller share. */}
        <path
          className={styles.wheelTrack}
          d={handArcPath({ cx: BOX / 2, cy: BOX / 2, radius: RADIUS, fromDeg: 0, toDeg: 360, seed: 9 })}
          fill="none"
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {arcs.map((arc, index) => (
          <path
            key={arc.key}
            className={styles.wheelArc}
            data-dosha={arc.key}
            d={handArcPath({
              cx: BOX / 2,
              cy: BOX / 2,
              radius: RADIUS,
              fromDeg: arc.fromDeg,
              toDeg: arc.toDeg,
              seed: index + 1,
            })}
            fill="none"
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
      </svg>

      <p className={styles.wheelType}>{resultLabel}</p>

      {/* The three scores, printed. */}
      <dl className={styles.wheelLegend}>
        {ORDER.map((key) => (
          <div className={styles.wheelLegendRow} key={key} data-dosha={key}>
            <dt>
              <span className={styles.wheelDot} aria-hidden="true" />
              {labels[key]}
            </dt>
            <dd>{scores[key] ?? 0}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
