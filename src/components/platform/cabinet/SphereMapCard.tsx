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
import { SPHERE_AXIS_IDS } from "@/lib/profile/sphereMap";
import type { ProfileLang } from "@/components/platform/profile/types";

import { matte } from "./CourseCard";
import { SphereRadar } from "./SphereRadar";
import { getSphereMapCopy, sphereName } from "./sphereMapCopy";
import { useSphereMap } from "./useSphereMap";
import styles from "./SphereMap.module.css";

export function SphereMapCard({ userId, lang, href }: { userId: string | null; lang: ProfileLang; href: string }) {
  const copy = getSphereMapCopy(lang);
  const { map } = useSphereMap(userId, copy.saveError);
  const rated = map ? SPHERE_AXIS_IDS.some((id) => map.spheres[id]?.now != null) : false;

  return (
    <article className={styles.card} {...matte}>
      {map && rated ? <SphereRadar map={map} title={copy.radarTitle} compact /> : null}
      <div className={styles.cardText}>
        <p className={styles.cardLabel}>{copy.cardLabel}</p>
        <h2 className={styles.cardTitle}>{copy.cardTitle}</h2>
        {map && rated ? (
          map.focus.length > 0 ? (
            <p className={styles.cardNote}>
              {copy.cardFocus}: {map.focus.map((id) => sphereName(id, lang)).join(", ")}
            </p>
          ) : null
        ) : (
          <p className={styles.cardNote}>{copy.cardEmpty}</p>
        )}
        <span className={styles.cardOnward}>
          <PlatformBlockLink href={href} label={rated ? copy.cardOpen : copy.cardStart} />
        </span>
      </div>
    </article>
  );
}
