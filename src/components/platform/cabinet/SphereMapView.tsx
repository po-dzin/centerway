"use client";

/**
 * The sphere map itself — radar, legend, focus, the A/B switch and the seven
 * rows — without the session, the read or the saves. `SphereMapClient` owns
 * those and hands this the map and three callbacks, so what is drawn here is a
 * function of its props and nothing else.
 */

import { useMemo, useState } from "react";

import {
  SPHERE_AXIS_IDS,
  SPHERE_FOCUS_MAX,
  SPHERE_NOTE_MAX,
  SPHERE_SCORE_MAX,
  SPHERE_SCORE_MIN,
  sphereGap,
  suggestFocus,
  type SphereAxisId,
  type SphereMap,
} from "@/lib/profile/sphereMap";
import type { ProfileLang } from "@/components/platform/profile/types";

import { matte } from "./CourseCard";
import { SphereRadar } from "./SphereRadar";
import { sphereName, sphereShort, type SphereMapCopy } from "./sphereMapCopy";
import cabinetStyles from "./Cabinet.module.css";
import styles from "./SphereMap.module.css";

type Mode = "now" | "goal";

const STEPS = Array.from({ length: SPHERE_SCORE_MAX - SPHERE_SCORE_MIN + 1 }, (_, index) => SPHERE_SCORE_MIN + index);

export function SphereMapView({
  map,
  lang,
  copy,
  setScore,
  setNote,
  flipFocus,
}: {
  map: SphereMap;
  lang: ProfileLang;
  copy: SphereMapCopy;
  setScore: (id: SphereAxisId, mode: Mode, value: number) => void;
  setNote: (id: SphereAxisId, note: string) => void;
  flipFocus: (id: SphereAxisId) => void;
}) {
  const [mode, setMode] = useState<Mode>("now");
  const [open, setOpen] = useState<SphereAxisId | null>(null);

  const labels = useMemo(
    () => Object.fromEntries(SPHERE_AXIS_IDS.map((id) => [id, sphereShort(id, lang)])) as Record<SphereAxisId, string>,
    [lang],
  );

  const suggested = suggestFocus(map.spheres);
  /* «На старті» is only worth drawing once there is a «зараз» to set it
     against: with one snapshot the two shapes are the same shape. */
  const start = map.history.length > 1 ? map.history[0] : null;
  const focusFull = map.focus.length >= SPHERE_FOCUS_MAX;

  return (
    <>
      <div className={styles.map}>
        <div className={styles.picture}>
          <SphereRadar map={map} start={start} labels={labels} title={copy.radarTitle} />
          <ul className={styles.legend}>
            <li className={styles.legendItem} data-shape="now">
              <span className={styles.legendSwatch} aria-hidden="true" />
              {copy.legendNow}
            </li>
            <li className={styles.legendItem} data-shape="goal">
              <span className={styles.legendSwatch} aria-hidden="true" />
              {copy.legendGoal}
            </li>
            {start ? (
              <li className={styles.legendItem} data-shape="start">
                <span className={styles.legendSwatch} aria-hidden="true" />
                {copy.legendStart}
              </li>
            ) : null}
          </ul>

          <article className={styles.focusCard} {...matte}>
            <h2 className={styles.focusTitle}>{copy.focusTitle}</h2>
            {map.focus.length > 0 ? (
              <ol className={styles.focusList}>
                {map.focus.map((id) => {
                  const gap = sphereGap(map.spheres[id]);
                  return (
                    <li key={id} className={styles.focusItem}>
                      <span>{sphereName(id, lang)}</span>
                      {gap !== null ? <span className={styles.focusGap}>{copy.gap(gap)}</span> : null}
                    </li>
                  );
                })}
              </ol>
            ) : (
              <p className={styles.focusNote}>{copy.focusEmpty}</p>
            )}
            {suggested.some((id) => !map.focus.includes(id)) ? (
              <p className={styles.focusNote}>
                {copy.focusSuggested}{" "}
                {suggested
                  .filter((id) => !map.focus.includes(id))
                  .map((id) => sphereName(id, lang))
                  .join(", ")}
              </p>
            ) : null}
          </article>
        </div>

        <div className={styles.controls}>
          <div className={styles.modeSwitches} role="group" aria-label={copy.modeLabel}>
            {(["now", "goal"] as const).map((value) => (
              <button
                key={value}
                type="button"
                className={mode === value ? styles.modeOptionOn : styles.modeOption}
                aria-pressed={mode === value}
                onClick={() => setMode(value)}
              >
                {value === "now" ? copy.modeNow : copy.modeGoal}
              </button>
            ))}
          </div>

          <ul className={styles.spheres}>
            {SPHERE_AXIS_IDS.map((id) => {
              const score = map.spheres[id] ?? { now: null, goal: null };
              const name = sphereName(id, lang);
              const isOpen = open === id;
              const inFocus = map.focus.includes(id);
              const candidate = !inFocus && suggested.includes(id);
              const bodyId = `sphere-${id}`;
              const value = mode === "now" ? score.now : score.goal;

              return (
                <li key={id} className={styles.sphere} data-open={isOpen || undefined}>
                  <button
                    type="button"
                    className={styles.sphereToggle}
                    aria-expanded={isOpen}
                    aria-controls={bodyId}
                    onClick={() => setOpen(isOpen ? null : id)}
                  >
                    <span className={styles.sphereHead}>
                      <span className={styles.sphereName}>{name}</span>
                      {inFocus ? <span className={styles.chip}>{copy.focusChip}</span> : null}
                      {candidate ? <span className={styles.chipQuiet}>{copy.candidateChip}</span> : null}
                      <span className={styles.sphereScores}>
                        {score.now ?? copy.unset} → {score.goal ?? copy.unset}
                      </span>
                    </span>
                    <span className={styles.meter} aria-hidden="true">
                      <span
                        className={styles.meterFill}
                        style={{ inlineSize: `${((score.now ?? 0) / SPHERE_SCORE_MAX) * 100}%` }}
                      />
                      {score.goal !== null ? (
                        <span
                          className={styles.meterTick}
                          style={{ insetInlineStart: `${(score.goal / SPHERE_SCORE_MAX) * 100}%` }}
                        />
                      ) : null}
                    </span>
                  </button>

                  {isOpen ? (
                    <div className={styles.sphereBody} id={bodyId}>
                      <div className={styles.scale} role="group" aria-label={copy.scaleLabel(name, mode)}>
                        {STEPS.map((step) => (
                          <button
                            key={step}
                            type="button"
                            className={styles.scaleOption}
                            data-lit={value !== null && step <= value ? mode : undefined}
                            aria-pressed={value === step}
                            onClick={() => setScore(id, mode, step)}
                          >
                            {step}
                          </button>
                        ))}
                      </div>
                      <p className={styles.hint}>{mode === "now" ? copy.hintNow : copy.hintGoal}</p>

                      {mode === "now" ? (
                        <label className={styles.note}>
                          <span className={styles.noteLabel}>{copy.noteLabel}</span>
                          <textarea
                            className={cabinetStyles.authorTextarea}
                            rows={2}
                            maxLength={SPHERE_NOTE_MAX}
                            placeholder={copy.notePlaceholder}
                            value={score.note ?? ""}
                            onChange={(event) => setNote(id, event.target.value)}
                          />
                        </label>
                      ) : null}

                      <div className={styles.sphereActions}>
                        <button
                          type="button"
                          className={styles.focusAction}
                          aria-pressed={inFocus}
                          disabled={!inFocus && focusFull}
                          onClick={() => flipFocus(id)}
                        >
                          {inFocus ? copy.focusRemove : copy.focusAdd}
                        </button>
                        {!inFocus && focusFull ? <p className={styles.focusNote}>{copy.focusFull}</p> : null}
                      </div>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      <p className={styles.footer}>{copy.footer}</p>
    </>
  );
}
