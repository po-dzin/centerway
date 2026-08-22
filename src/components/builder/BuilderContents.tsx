"use client";

/**
 * The course's structure, as navigation.
 *
 * ONE component, two presentations: a rail beside the editor on a desk, the
 * same node as a drawer below 901px. Two lists would be two places to fix a
 * bug and two chances for them to disagree about which lesson is current.
 *
 * NAVIGATION ONLY — no add, no delete, no reorder. Those live on the course
 * page, where the whole structure is the subject rather than a companion to
 * something else. A rail that could add a lesson but not move it is half a
 * tool, and the half it is missing is the half an author reaches for next.
 */

import type { Course } from "@/lms-core";
import styles from "./Builder.module.css";

export function BuilderContents({
  course,
  currentSlug,
  onNavigate,
}: {
  course: Course;
  currentSlug?: string;
  onNavigate: (href: string) => void;
}) {
  return (
    <nav className={styles.contentsPanel} aria-label="Уроки курсу">
      <button
        className={styles.contentsRoot}
        type="button"
        onClick={() => onNavigate(`/build/${course.slug}`)}
      >
        Структура курсу
      </button>

      {course.modules.map((entry) => (
        <div className={styles.contentsGroup} key={entry.id}>
          <h2 className={styles.moduleTitle}>
            {entry.title}
            {entry.reference ? " · довідка" : ""}
          </h2>
          {entry.lessons.map((item) => (
            <button
              key={item.id}
              className={styles.contentsLink}
              type="button"
              aria-current={item.slug === currentSlug ? "page" : undefined}
              onClick={() => onNavigate(`/build/${course.slug}/${item.slug}`)}
            >
              <span className={styles.lessonDay}>{item.dayIndex ? `Д${item.dayIndex}` : "—"}</span>
              <span className={styles.lessonName}>{item.title}</span>
            </button>
          ))}
        </div>
      ))}
    </nav>
  );
}
