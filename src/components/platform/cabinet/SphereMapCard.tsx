"use client";

/**
 * The sphere map on the profile, as one card and one crossing — the shape the
 * journal takes there. A thumbnail of the radar, the focus in one line, and
 * the way to `/profile/map`, where the map is read and changed.
 *
 * Its read is its own and fails on its own: a map that cannot be loaded costs
 * this card and nothing else on the profile, so a failure renders the plain
 * invitation rather than an error panel on the dashboard.
 */

import { PlatformBlockLink } from "@/components/platform/PlatformBlock";
import { EMPTY_SPHERE_MAP, SPHERE_AXIS_IDS } from "@/lib/profile/sphereMap";
import type { ProfileLang } from "@/components/platform/profile/types";

import { matte } from "./CourseCard";
import { SphereRadar } from "./SphereRadar";
import { getSphereMapCopy, sphereName } from "./sphereMapCopy";
import { useSphereMap } from "./useSphereMap";
import styles from "./SphereMap.module.css";

export function SphereMapCard({
  userId,
  lang,
  href,
  tile = false,
  onOpen,
}: {
  userId: string | null;
  lang: ProfileLang;
  href: string;
  /**
   * The overview's tile (G 23.10: «Продовжити | Карта | Доша»): the same
   * column as the course and the dosha beside it, the radar on top and the
   * words under it.
   */
  tile?: boolean;
  /** Open the profile's «Карта» tab in place instead of following the link. */
  onOpen?: () => void;
}) {
  const copy = getSphereMapCopy(lang);
  const { map } = useSphereMap(userId, copy.saveError);
  const rated = map ? SPHERE_AXIS_IDS.some((id) => map.spheres[id]?.now != null) : false;

  return (
    <article
      className={tile ? styles.tile : styles.card}
      data-cw-tile={tile ? "map" : undefined}
      aria-label={tile ? copy.cardTitle : undefined}
      {...matte}
    >
      {/* THE OVERVIEW'S ONE RECIPE (G 23.10, «в артефакте лучше»): every tile
          opens with the same small label, the picture in the middle, the words
          and the way on at the foot — not a display-size title in one tile and
          none in the next. */}
      {tile ? <p className={styles.cardLabel}>{copy.cardLabel}</p> : null}
      {/* On the overview the web is drawn even before the first score: the
          tile's picture is the map's shape, and an empty one says «not drawn
          yet» better than a hole in the middle of the tile. */}
      {map && rated ? (
        <SphereRadar map={map} title={copy.radarTitle} compact />
      ) : tile ? (
        <SphereRadar map={map ?? EMPTY_SPHERE_MAP} title={copy.radarTitle} compact />
      ) : null}
      <div className={styles.cardText}>
        {tile ? null : <p className={styles.cardLabel}>{copy.cardLabel}</p>}
        {tile ? null : <h2 className={styles.cardTitle}>{copy.cardTitle}</h2>}
        {map && rated ? (
          map.focus.length > 0 ? (
            <p className={styles.cardNote}>
              {copy.cardFocus}: {map.focus.map((id) => sphereName(id, lang)).join(", ")}
            </p>
          ) : null
        ) : (
          <p className={styles.cardNote}>{copy.cardEmpty}</p>
        )}
        <span
          className={styles.cardOnward}
          onClickCapture={
            onOpen
              ? (event) => {
                  if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
                  event.preventDefault();
                  onOpen();
                }
              : undefined
          }
        >
          <PlatformBlockLink href={href} label={rated ? copy.cardOpen : copy.cardStart} />
        </span>
      </div>
    </article>
  );
}
