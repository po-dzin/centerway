"use client";

/**
 * The cabinet's hero: a room, and the library it opens onto.
 *
 * WHAT CHANGED, AND WHY THE OLD SHAPE WAS WRONG (2026-08-27). The first version
 * put the room on the left as a drawn panel and the photograph on the right as
 * a card — a doorway you looked at from outside, in a slot half the width of
 * the page. That reads as a picture of a room pinned to a dashboard, not as
 * being in one. The photograph is the ground now: it covers the whole plate,
 * the identity stands in it, and it dissolves downward into the page's own
 * paper — where the shelf of courses sits, drawn rather than photographed, with
 * one brass orbit on the line where the two grounds meet.
 *
 * So the block says the product's own sentence in one object: you are in your
 * room, the room is a photograph, and it turns into the drawn space of the
 * library as you move down it. There is no second surface floating on the
 * plate — the earlier landing-hero mistake — because the plate IS the block.
 *
 * Layout and material live in the CSS module. This file decides only what goes
 * in the room, and takes the shelf as children so the four states of the
 * learner's courses (some, loading, failed, none) stay owned by the page that
 * reads them.
 */

import type { ReactNode } from "react";

import { HandGraphic } from "@/components/Icon";
import styles from "./CabinetHero.module.css";

/**
 * The threshold plate, shared with the home hero rather than copied.
 *
 * Served from the landing bundle at this path on every host including `www`
 * (verified live), and carrying its own baked sRGB profile — an untagged webp
 * next to a paper-coloured panel is where the faint iOS colour seam comes from,
 * and this file is not untagged.
 */
/**
 * The cabinet's own plate, generated for this screen (2026-08-27).
 *
 * NOT the home hero's threshold photograph any more, and not because of the
 * subject: the dissolve into the page's paper is BAKED INTO THESE FILES. The
 * cabinet used to paint that gradient in CSS over the shared plate, which on a
 * dark photograph reads as a white veil laid on top — two visible layers, with
 * the veil following the layout instead of the picture. Here the frame itself
 * ends in `--cw-mat-surface`, so the page places an image and the seam is
 * already inside it. `scripts/img/grade.mjs --fade-bottom` is what bakes it.
 *
 * Two masters for the two shapes of a full screen: a 16:9 room, and the same
 * room restaged tall — a cover crop of the landscape one on a phone would show
 * a slice of wall and neither the opening nor the shelves in it.
 */
const ROOM_PLATE = "/cw/platform/cabinet/room-v1.webp";
const ROOM_PLATE_PORTRAIT = "/cw/platform/cabinet/room-portrait-v1.webp";

export type CabinetHeroStat = {
  /** The field name: "Доша", "Бібліотека", "Продукти". */
  label: string;
  /** A VALUE — a dosha name, a count, an em dash — never a sentence. */
  value: ReactNode;
};

export function CabinetHero({
  label,
  name,
  email,
  avatar,
  stats,
  children,
}: {
  label: string;
  name: string;
  email: string;
  /** The account picture, or the initial standing in for one. */
  avatar: ReactNode;
  stats: CabinetHeroStat[];
  /** The shelf: the course to resume, the rest of them, or a single state card. */
  children: ReactNode;
}) {
  return (
    <header className={styles.hero} data-cw-material="matte">
      {/* THE WHOLE BLOCK IS ONE SCREEN. The shelf used to start below the
          plate, so the one thing a returning learner comes here to do —
          continue — was under the fold on every laptop. It stands on the
          paper end of the photograph now, inside the same 100svh box: the room
          on the wall at the top, the courses on the floor at the bottom.

          THE TONE IS DECLARED ON THE PLATE, NOT ON THE BLOCK. `headerTone.ts`
          reads whichever `[data-cw-topbar-tone]` element the bar is currently
          over, so the declaration has to end where the photograph does — put it
          on the whole hero and the bar would stay inverted while it floats over
          the paper shelf below. Without it at all the bar sampled the page's
          own surface and kept its dark ink: dark labels on a dark picture, and
          an account menu that opened dark-on-dark. */}
      <div className={styles.plateWrap} data-cw-topbar-tone="dark">
        {/* Decorative in the strict sense: it is the ground of the screen, and
            everything it means is written in the text standing on it. */}
        <picture>
          <source media="(orientation: portrait) and (max-width: 900px)" srcSet={ROOM_PLATE_PORTRAIT} />
          <img className={styles.plate} src={ROOM_PLATE} alt="" decoding="async" />
        </picture>
        <div className={styles.wash} aria-hidden="true" />
      {/* The one drawn mark, on the line where the photograph becomes paper.
          The library's own vocabulary (see the depth prototype): brass line,
          no fill, no glow. One is a signature; two would be decoration. */}
      <HandGraphic className={styles.seamMark} name="orbit" size={224} aria-hidden="true" />

        <div className={styles.room}>
          <div className={styles.identityMain}>
            <span className={styles.avatar} aria-hidden="true">
              {avatar}
            </span>
            <div className={styles.identityText}>
              <p className={styles.sectionLabel}>{label}</p>
              <h1 className={styles.identityName}>{name}</h1>
              <p className={styles.identityEmail}>{email}</p>
            </div>
          </div>

          <dl className={styles.stats}>
            {stats.map((stat) => (
              <div className={styles.stat} key={stat.label}>
                <dt className={styles.sectionLabel}>{stat.label}</dt>
                <dd>{stat.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className={styles.shelf}>
        {/* NO HEADING AND NO LINK OVER THE ROW. «Бібліотека» named what the
            cards already are; «Усі мої курси» then stood above the whole
            composition as a fourth object, pointing at nothing next to it. The
            way onward is the last row of the column of courses now — where the
            list actually runs out. */}
          {children}
        </div>
      </div>
    </header>
  );
}
