"use client";

/**
 * Карта сфер, at `/profile/map` — the person's own map of seven spheres.
 *
 * WHY A PAGE AND NOT A TAB. The profile stopped being a container of tabs on
 * 2026-08-28 (see `CabinetClient`): it answers «where did I stop» in one
 * scroll, and each thing a person returns to on its own — the library, the
 * journal — is one crossing away. The map is that kind of thing, so it takes
 * the journal's shape: a card on the profile, and a page under `/profile`
 * where it is read and changed. It lives under the cabinet's own prefix, so
 * the personal host serves it without a new route family.
 *
 * WHAT IT ANSWERS: «where is my attention going, and where do I want it to
 * go». Two numbers per sphere, A now and B in a year; the gap between them
 * proposes the cycle's focus, and the person chooses it.
 *
 * Selection families (docs/design-system.md → «Selection grammar»):
 *   - the A/B switch: contour — two plated buttons, the chosen one primary;
 *   - the 0–10 scale: contour — one chosen cell in a segmented track;
 *   - a sphere row: contour — a disclosure row, `aria-expanded`;
 *   - the focus button: contour — a secondary plate, `aria-pressed`.
 */

import { useMemo } from "react";

import surfaceStyles from "@/components/platform/PlatformSurfaceStyles";
import { PlatformLoadingState } from "@/components/platform/PlatformLoadingState";
import { PlatformPageHead } from "@/components/platform/PlatformPageHead";
import { cabinetGate } from "./CabinetGate";
import { SphereMapView } from "./SphereMapView";
import { getSphereMapCopy } from "./sphereMapCopy";
import { useCabinetSession, useProfileLang } from "./useCabinet";
import { useSphereMap } from "./useSphereMap";
import cabinetStyles from "./Cabinet.module.css";
import styles from "./SphereMap.module.css";

export function SphereMapClient() {
  const lang = useProfileLang();
  const copy = useMemo(() => getSphereMapCopy(lang), [lang]);
  const { session, loading: sessionLoading, signInWithGoogle } = useCabinetSession();
  const userId = session?.user?.id ?? null;
  const { map, failed, retry, setScore, setNote, flipFocus } = useSphereMap(userId, copy.saveError);

  const loadingView = (
    <main className={surfaceStyles.profileMain} data-cw-platform-template="loading">
      <div className={cabinetStyles.shell}>
        <PlatformLoadingState label={copy.label} title={copy.loadingTitle} detail={copy.loadingLead} />
      </div>
    </main>
  );

  const gate = cabinetGate({
    lang,
    loading: sessionLoading,
    session,
    onSignIn: (intent) => void signInWithGoogle(intent),
    loadingFallback: loadingView,
  });
  if (gate) return gate;
  if (!failed && map === null) return loadingView;

  if (failed || !map) {
    return (
      <main className={surfaceStyles.profileMain} data-cw-platform-template="sphere-map">
        <div className={cabinetStyles.shell}>
          <PlatformPageHead label={copy.label} title={copy.title} lead={copy.lead} />
          <div className={styles.state}>
            <h2 className={styles.stateTitle}>{copy.errorTitle}</h2>
            <p className={styles.stateNote}>{copy.errorLead}</p>
            <div className={styles.stateAction}>
              <button className={styles.retryAction} type="button" onClick={retry}>
                {copy.retry}
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className={surfaceStyles.profileMain} data-cw-platform-template="sphere-map">
      <div className={cabinetStyles.shell}>
        <PlatformPageHead label={copy.label} title={copy.title} lead={copy.lead} />
        <SphereMapView map={map} lang={lang} copy={copy} setScore={setScore} setNote={setNote} flipFocus={flipFocus} />
      </div>
    </main>
  );
}
