"use client";

/**
 * The «Карта» and «Ритм» tabs of the profile (G 23.10): the sphere map with
 * its cycle, and the day constructor the map's bridge feeds. One component for
 * both, so switching between them keeps one read and one queue of saves — a
 * step written in the bridge is in «Мій ритм» the moment the tab opens. The
 * read and save are their own (`useSphereMap`) and fail on their own: a map
 * that cannot be loaded costs these tabs, never the profile around them.
 */

import { useMemo } from "react";

import { PlatformLoadingState } from "@/components/platform/PlatformLoadingState";
import type { ProfileLang } from "@/components/platform/profile/types";

import { RhythmView } from "./RhythmView";
import { SphereCycleView } from "./SphereCycleView";
import { getCycleCopy } from "./cycleCopy";
import { getSphereMapCopy } from "./sphereMapCopy";
import { useSphereMap } from "./useSphereMap";
import styles from "./SphereMap.module.css";

export function ProfileMapTab({
  userId,
  lang,
  view = "map",
  onView,
}: {
  userId: string | null;
  lang: ProfileLang;
  view?: "map" | "rhythm";
  onView?: (view: "map" | "rhythm") => void;
}) {
  const copy = useMemo(() => getSphereMapCopy(lang), [lang]);
  const { map, failed, retry, setScore, setNote, setCycle, setRhythm, edit } = useSphereMap(userId, copy.saveError);

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

  if (view === "rhythm") {
    return (
      <section className={styles.tabBody} aria-label={getCycleCopy(lang).rhythmTitle}>
        <RhythmView doc={map} lang={lang} setRhythm={setRhythm} onGoMap={onView ? () => onView("map") : undefined} />
      </section>
    );
  }

  return (
    <section className={styles.tabBody} aria-label={copy.title}>
      <p className={styles.tabLead}>{copy.lead}</p>
      <SphereCycleView
        doc={map}
        lang={lang}
        setScore={setScore}
        setNote={setNote}
        setCycle={setCycle}
        edit={edit}
        onGoRhythm={onView ? () => onView("rhythm") : undefined}
      />
    </section>
  );
}
