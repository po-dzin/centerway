"use client";

import type { ReadinessBlocker } from "@/lms-core";

import styles from "./Builder.module.css";

/* Every code `courseReadiness` can emit. An unlisted code falls through to its
   raw form rather than to a generic phrase — an author reading `lms_ready_x`
   can search for it; an author reading "щось не так" cannot. */
const BLOCKER_LABELS: Record<string, string> = {
  lms_ready_placeholder: "Незаповнений маркер",
  lms_ready_invalid_href: "Посилання не веде нікуди",
  lms_ready_invalid_video_id: "Невалідний ID відео",
  lms_ready_invalid_image_src: "Зображення без файлу",
  lms_ready_missing_boundary: "У тілесному протоколі немає блоку меж",
};

/**
 * What is still stopping a publish, in the author's words.
 *
 * The `path` stays raw and visible. It is the one part of a blocker that says
 * exactly WHERE the problem is (`way21.week-1.day-2.blocks[3]`), and dressing it
 * up as prose would cost the author the only thing that lets them go straight
 * to it. The code gets a translation; the address does not need one.
 */
export function BuilderBlockers({ blockers }: { blockers: ReadinessBlocker[] }) {
  if (blockers.length === 0) {
    return (
      <section className={styles.panel}>
        <h2 className={styles.panelTitle}>Готовність</h2>
        <p className={styles.panelText}>Блокерів немає — курс можна публікувати.</p>
      </section>
    );
  }

  return (
    <section className={styles.panel}>
      <h2 className={styles.panelTitle}>Що заважає публікації</h2>
      <ul className={styles.blockerList}>
        {blockers.map((blocker, index) => (
          <li key={`${blocker.path}-${index}`} className={styles.blockerItem}>
            <span className={styles.blockerPath}>{blocker.path}</span>
            <span className={styles.blockerDetail}>
              {BLOCKER_LABELS[blocker.code] ?? blocker.code}
              {blocker.detail ? ` — ${blocker.detail}` : ""}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
