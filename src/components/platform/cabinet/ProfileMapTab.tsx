"use client";

/**
 * The «Карта» tab of the profile (G 23.10): the sphere map inside the profile,
 * under the same room, instead of a page of its own. The map's read and save
 * are its own (`useSphereMap`) and fail on their own: a map that cannot be
 * loaded costs this tab, never the profile around it.
 */

import { useMemo } from "react";

import { PlatformLoadingState } from "@/components/platform/PlatformLoadingState";
import type { ProfileLang } from "@/components/platform/profile/types";

import { SphereMapView } from "./SphereMapView";
import { getSphereMapCopy } from "./sphereMapCopy";
import { useSphereMap } from "./useSphereMap";
import styles from "./SphereMap.module.css";

export function ProfileMapTab({ userId, lang }: { userId: string | null; lang: ProfileLang }) {
  const copy = useMemo(() => getSphereMapCopy(lang), [lang]);
  const { map, failed, retry, setScore, setNote, flipFocus } = useSphereMap(userId, copy.saveError);

  if (!failed && map === null) {
    return <PlatformLoadingState label={copy.label} title={copy.loadingTitle} detail={copy.loadingLead} />;
  }

  if (failed || !map) {
    return (
      <div className={styles.state}>
        <h2 className={styles.stateTitle}>{copy.errorTitle}</h2>
        <p className={styles.stateNote}>{copy.errorLead}</p>
        <div className={styles.stateAction}>
          <button className={styles.retryAction} type="button" onClick={retry}>
            {copy.retry}
          </button>
        </div>
      </div>
    );
  }

  return (
    <section className={styles.tabBody} aria-label={copy.title}>
      <p className={styles.tabLead}>{copy.lead}</p>
      <SphereMapView map={map} lang={lang} copy={copy} setScore={setScore} setNote={setNote} flipFocus={flipFocus} />
    </section>
  );
}
