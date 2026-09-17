"use client";

import { useState } from "react";

import type { BuilderAudienceDay } from "./builderClient";
import { dayReadout, shortDay } from "./builderOverview";
import styles from "./Builder.module.css";

/**
 * How many distinct people opened a lesson, per Kyiv day, over the last month.
 *
 * ONE SERIES, ONE AXIS, NO LEGEND. The heading above names the series; the
 * scale prints only the maximum and zero, because an author reads this for its
 * shape — «is anyone still coming back» — not for a value between gridlines.
 *
 * THE READOUT IS THE TOOLTIP. A floating tooltip over thirty thin bars covers
 * the bars beside the one it names, and is unreachable by touch. The line above
 * the plot names the day under the pointer and otherwise the latest day, so the
 * value never depends on hovering. A visually hidden table carries every day
 * for a screen reader; the bars themselves are decoration to it.
 *
 * Zero is drawn, not skipped: a quiet day is a 2px mark in the rule's ink, so a
 * gap in reading reads as a gap rather than as missing data.
 */
export function BuilderActivityChart({ days }: { days: BuilderAudienceDay[] }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const first = days[0];
  const last = days[days.length - 1];
  if (!first || !last) return null;

  const max = Math.max(1, ...days.map((day) => day.learners));
  const shownIndex = hovered ?? days.length - 1;
  const shown = days[shownIndex] ?? last;

  return (
    <>
      <p className={styles.overviewChartReadout} aria-hidden="true">
        {dayReadout(shown)}
      </p>
      <div className={styles.overviewChart} aria-hidden="true">
        <div className={styles.overviewChartPlot} onPointerLeave={() => setHovered(null)}>
          {days.map((day, index) => (
            <div
              key={day.date}
              className={styles.overviewChartColumn}
              data-current={index === shownIndex || undefined}
              onPointerEnter={() => setHovered(index)}
            >
              <div
                className={styles.overviewChartBar}
                data-empty={day.learners === 0 || undefined}
                style={{ height: day.learners === 0 ? undefined : `${(day.learners / max) * 100}%` }}
              />
            </div>
          ))}
        </div>
        <div className={styles.overviewChartScale}>
          <span>{max}</span>
          <span>0</span>
        </div>
        <div className={styles.overviewChartAxis}>
          <span>{shortDay(first.date)}</span>
          <span>{shortDay(last.date)}</span>
        </div>
      </div>
      <table className={styles.visuallyHidden}>
        <caption>Скільки людей відкривали уроки, за днями</caption>
        <thead>
          <tr>
            <th scope="col">День</th>
            <th scope="col">Людей</th>
          </tr>
        </thead>
        <tbody>
          {days.map((day) => (
            <tr key={day.date}>
              <td>{shortDay(day.date)}</td>
              <td>{day.learners}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
