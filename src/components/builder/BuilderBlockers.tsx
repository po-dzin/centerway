"use client";

import type { Course, ReadinessBlocker } from "@/lms-core";

import { Icon } from "@/components/Icon";
import { blockerTarget } from "./blockerTargets";
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
  // The five the showcase gate adds. They fire only once the course is pointed
  // at strangers — see `courseReadiness` — so an author who reads one is
  // already looking at a catalogue entry, not at a private draft.
  lms_ready_missing_cover: "Немає обкладинки — картка в каталозі буде порожньою",
  lms_ready_missing_cover_alt: "Обкладинка без опису для читача з екранним диктором",
  lms_ready_missing_tagline: "Немає рядка під назвою — картці нічого сказати",
  lms_ready_missing_duration: "Не вказано тривалість у днях",
  lms_ready_missing_category: "Не вказано розділ — курс ніде буде знайти",
};

/**
 * What is still stopping a publish, in the author's words.
 *
 * The `path` stays raw and visible. It is the one part of a blocker that says
 * exactly WHERE the problem is (`way21.week-1.day-2.blocks[3]`), and dressing it
 * up as prose would cost the author the only thing that lets them go straight
 * to it. The code gets a translation; the address does not need one.
 *
 * AND NOW THE ADDRESS IS ALSO A DOOR. Reading it was still the author's job:
 * the middle segment is a module, the last is a lesson, and «blocks[3]» is the
 * fourth card down a document they have to open first. The arrow resolves that
 * for them — an ordinary link, so the shell's own flush-then-route handles it
 * like any other move inside the course (`useBuilderExit`), and the lesson
 * editor selects the block named in the hash on arrival.
 */
/**
 * How many blockers are listed before the rest are counted instead.
 *
 * A course created from the twenty-one-day template is born with roughly sixty
 * marked holes — which is honest, it really does have twenty-one unwritten
 * days. Rendering all sixty turns the first screen of a new course into a wall
 * of identical red lines, and a wall is not a list of things to do. Twelve is
 * about a screen; the count carries the rest.
 */
const LISTED = 12;

export function BuilderBlockers({ course, blockers }: { course: Course; blockers: ReadinessBlocker[] }) {
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
        {blockers.slice(0, LISTED).map((blocker, index) => {
          const target = blockerTarget(course, blocker);
          return (
            <li key={`${blocker.path}-${index}`} className={styles.blockerItem}>
              <span className={styles.blockerPath}>{blocker.path}</span>
              <span className={styles.blockerDetail}>
                {BLOCKER_LABELS[blocker.code] ?? blocker.code}
                {blocker.detail ? ` — ${blocker.detail}` : ""}
              </span>
              {/* Absent rather than disabled when the address resolves to
                  nothing: a blocker on a lesson that has since been deleted is
                  a stale report, and an arrow that goes nowhere is worse than
                  no arrow. */}
              {target ? (
                <a
                  className={styles.blockerOpen}
                  href={target.href}
                  aria-label={`Відкрити: ${target.label}`}
                  title={`Відкрити: ${target.label}`}
                >
                  <Icon name="arrow-right" size={18} />
                </a>
              ) : null}
            </li>
          );
        })}
      </ul>
      {blockers.length > LISTED ? (
        <p className={styles.panelText}>
          …і ще {blockers.length - LISTED} {plural(blockers.length - LISTED, "дірка", "дірки", "дірок")}. Кожна
          позначена в редакторі того уроку, якому належить.
        </p>
      ) : null}
    </section>
  );
}

function plural(count: number, one: string, few: string, many: string): string {
  const mod100 = count % 100;
  if (mod100 >= 11 && mod100 <= 14) return many;
  const mod10 = count % 10;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}
