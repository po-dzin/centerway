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
// The reach notice is a CabinetClient concern wearing the avatar as a
// mounting point — the badge, its colour and its text all come from
// `reach`, which this file has never known about and should not have to.
// Its three classes live in Cabinet.module.css, beside the alert they
// replaced, rather than in this module.
import cabinetStyles from "./Cabinet.module.css";

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
 * subject: this screen needs a frame composed to be STOOD IN, and a shared
 * plate cropped to a phone is not one.
 *
 * These are the ungraded-fade masters. The v2 pair ended in the light surface's
 * cream — `grade.mjs --fade-bottom` bakes the page's paper into the last third
 * of the frame — which was exactly right until the night palette shipped and the
 * bottom of the cabinet came out as a cream slab on a graphite page. The
 * dissolve is a mask in the CSS module now, so the file states the room and the
 * theme states the ground.
 *
 * Two masters for the two shapes of a full screen: a 16:9 room, and the same
 * room restaged tall — a cover crop of the landscape one on a phone would show
 * a slice of wall and neither the opening nor the shelves in it.
 *
 * v3 (2026-08-28) is v1's frame and v1's grade with no fade at all — the two
 * earlier pairs differ from it only in how much paper was painted into the
 * bottom. Regenerating them is one line each:
 * `node scripts/img/grade.mjs public/cw/img/_staging/cabinet/backdrop-cabinet-room-dark-16x9-1.png
 *  --out public/cw/platform/cabinet/room-v3.webp --width 2560` (and the 9x16
 * source at `--width 1400` for the portrait master).
 */
const ROOM_PLATE = "/cw/platform/cabinet/room-v3.webp";
const ROOM_PLATE_PORTRAIT = "/cw/platform/cabinet/room-portrait-v3.webp";

export type CabinetHeroStat = {
  /** The field name: "Доша", "Бібліотека", "Продукти". */
  label: string;
  /** A VALUE — a dosha name, a count, an em dash — never a sentence. */
  value: ReactNode;
};

export type CabinetHeroNotice = {
  /** The notice itself, revealed beside the dot — a sentence, not a tooltip title. */
  label: string;
  /** The label on the way out of it. The dot marks; only this navigates. */
  action: string;
  href: string;
};

export function CabinetHero({
  label,
  name,
  email,
  avatar,
  avatarRing,
  notice,
  stats,
  children,
}: {
  label: string;
  name: string;
  email: string;
  /** The account picture, or the initial standing in for one. */
  avatar: ReactNode;
  /** Optional diagnostic outline; the adjacent stat carries its textual meaning. */
  avatarRing?: ReactNode;
  /** A fact worth a glance, not a sentence — see the reach dot below. */
  notice?: CabinetHeroNotice;
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
            {/* THE DOT, NOT THE BAR. This used to be a full-width line under
                the shelf, stated once at the weight of a panel — an answer to
                a fact that is about THIS ACCOUNT, sitting a full screen away
                from where the account is named. Reachability is a property of
                the identity above the fold, so it rides the identity: a status
                dot on the avatar's own corner, the way a chat client marks an
                account rather than posting a banner about it.

                THE DOT DOES NOT NAVIGATE. A 0.7rem mark that leaves the site
                the moment it is touched is a trapdoor: it asks for a click
                before it has said what it is, and the thing on the far side is
                Telegram. So the dot only marks. Resting on it — or reaching it
                with a keyboard — states the notice, and the way out sits inside
                that statement as an ordinary link, read first and pressed
                second. Hover and focus-within do the revealing between them; no
                open flag is threaded through this component for it. */}
            <span className={cabinetStyles.avatarNoticeWrap}>
              {avatarRing ? (
                <span className={styles.avatarRing} aria-hidden="true">
                  {avatarRing}
                </span>
              ) : null}
              <span className={styles.avatar} aria-hidden="true">
                {avatar}
              </span>
              {notice ? (
                <span className={cabinetStyles.avatarNotice}>
                  <span className={cabinetStyles.avatarNoticeDot} aria-hidden="true" />
                  <span className={cabinetStyles.avatarNoticePop}>
                    <span className={cabinetStyles.avatarNoticeText}>{notice.label}</span>
                    <a
                      className={cabinetStyles.avatarNoticeLink}
                      href={notice.href}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {notice.action}
                    </a>
                  </span>
                </span>
              ) : null}
            </span>
            <div className={styles.identityText}>
              <p className={styles.sectionLabel}>{label}</p>
              <h1 className={styles.identityName}>{name}</h1>
              <p className={styles.identityEmail}>{email}</p>
            </div>
          </div>

          <dl className={styles.stats} data-cw-rule="inverse">
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
