"use client";

/**
 * The cabinet's hero: the room you are in, and the way out of it.
 *
 * It answers both of the dashboard's questions in one block — "who am I here"
 * and "what do I open right now" — and then points at the only place the
 * answer to the second one can grow: the library.
 *
 * The doorway is not an illustration of that idea, it is the link. The plate is
 * the home hero's own threshold photograph (a dark stone entry, sandals left at
 * the door, an opening onto a lit wooden room), framed on the opening rather
 * than on the whole scene, and clicking it goes to the shelf. The two grounds —
 * drawn room, photographed view — are the point: this surface sits between the
 * public pages, which are photographic, and the library, which is drawn.
 *
 * Layout and material live in the CSS module. This file decides only what goes
 * in the room, and takes the resume slot as children so the four states of the
 * shelf (a course, loading, failed, empty) stay owned by the page that reads
 * it.
 */

import Link from "next/link";
import type { ReactNode } from "react";

import styles from "./CabinetHero.module.css";

/**
 * The threshold plate, shared with the home hero rather than copied.
 *
 * Served from the landing bundle at this path on every host including `www`
 * (verified live), and carrying its own baked sRGB profile — an untagged webp
 * next to a paper-coloured panel is where the faint iOS colour seam comes from,
 * and this file is not untagged.
 */
const DOORWAY_PLATE = "/shared/img/home-hero-threshold-2026-08.webp";

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
  doorwayTitle,
  doorwayLead,
  doorwayHref,
  children,
}: {
  label: string;
  name: string;
  email: string;
  /** The account picture, or the initial standing in for one. */
  avatar: ReactNode;
  stats: CabinetHeroStat[];
  doorwayTitle: string;
  doorwayLead: string;
  doorwayHref: string;
  /** The resume card, or whichever of its states the shelf is in. */
  children: ReactNode;
}) {
  return (
    <header className={styles.hero} data-cw-material="matte">
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

        <div className={styles.resume}>{children}</div>
      </div>

      <Link className={styles.doorway} href={doorwayHref}>
        {/* Decorative in the strict sense: it carries the meaning, and the
            meaning is also written in the label below it. A description here
            would be read out twice. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={styles.doorwayImage} src={DOORWAY_PLATE} alt="" decoding="async" />
        <span className={styles.doorwayLabel}>
          <span className={styles.doorwayTitle}>{doorwayTitle}</span>
          <span className={styles.doorwayLead}>
            {doorwayLead}
            <span className={styles.doorwayArrow} aria-hidden="true">
              →
            </span>
          </span>
        </span>
      </Link>
    </header>
  );
}
