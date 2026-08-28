"use client";

import { useState } from "react";

import { Icon } from "@/components/Icon";
import { COURSE_TEMPLATES, PLACEHOLDER_MARKER, type Course, type CourseTemplateId } from "@/lms-core";
import styles from "./Builder.module.css";

/**
 * The starting structure, in the two shapes one control has to take.
 *
 * IT LIVES IN THE STRUCTURE NOW. It was folded inside «Додатково» on the
 * «Огляд» tab — the one control that rewrites the whole of «Зміст», parked on a
 * different tab from the thing it rewrites, behind a disclosure. Same rule the
 * lesson import follows: a control that CREATES belongs at the level that knows
 * where the result goes.
 *
 * TWO FORMATS, BECAUSE IT IS TWO DIFFERENT ACTS, and which one it is depends
 * entirely on whether there is any work to lose:
 *
 * - `start` — the course is still the untouched placeholder. Then this is the
 *   most useful thing on the screen and it opens the tab: «З чого почнемо».
 *   Nothing is destroyed, so nothing is asked.
 * - `replace` — the course has content. Then the same control is a wrecking
 *   ball, so it is folded away at the foot of the list and asks first.
 *
 * WHY IT IS NOT SIMPLY «AN EMPTY COURSE». There is no such thing:
 * `validateCourse` refuses a course with zero modules, so `createCourse` has to
 * seed one, and an author lands on `Модуль 1 / Урок 1` whether they wanted that
 * shape or not. `isPristineStructure` recognises that seeded state instead —
 * one module, one lesson, and every hole still unfilled — which is the honest
 * reading of "this course has not been started yet".
 */

/**
 * Nothing here was written by a person yet.
 *
 * The placeholder marker is what a template leaves in every hole it makes, so
 * its presence everywhere is the same statement as "untouched". Deliberately
 * strict: one module, one lesson. A second lesson means the author has begun
 * arranging the course, and at that point the shape is theirs to keep — even if
 * every block in it is still a placeholder.
 */
export function isPristineStructure(course: Course): boolean {
  if (course.modules.length !== 1) return false;
  const [only] = course.modules;
  if (only.lessons.length !== 1) return false;
  const [lesson] = only.lessons;
  if (lesson.blocks.length > 1) return false;
  const written = [only.title, lesson.title, lesson.summary ?? ""].join(" ");
  return written.includes(PLACEHOLDER_MARKER) || /^(Модуль|Урок)\s*\d+$/.test(only.title.trim());
}

export function BuilderStructureStart({
  format,
  onApply,
}: {
  format: "start" | "replace";
  onApply: (template: CourseTemplateId) => void;
}) {
  const [selected, setSelected] = useState<CourseTemplateId>(COURSE_TEMPLATES[0]?.id ?? "blank");
  const [confirming, setConfirming] = useState(false);

  /* Each option carries its own one-line summary here, which the folded version
     never had room for. On the tab an author opens FIRST, «Практикум на 3 дні»
     against «Програма на 21 день» is a choice about the shape of their work,
     and four bare words is not enough to make it with. */
  const options = (
    <div className={styles.structureStartGrid} role="radiogroup" aria-label="Стартова структура">
      {COURSE_TEMPLATES.map((option) => (
        <button
          key={option.id}
          className={styles.structureStartOption}
          type="button"
          role="radio"
          aria-checked={selected === option.id}
          onClick={() => setSelected(option.id)}
        >
          <strong>{option.title}</strong>
          <small>{option.summary}</small>
        </button>
      ))}
    </div>
  );

  if (format === "start") {
    return (
      <div className={styles.structureStart}>
        <h3 className={styles.structureStartTitle}>З чого почнемо?</h3>
        <p className={styles.structureStartLead}>
          Готовий каркас — модулі, уроки й позначені місця, які лишиться заповнити. Змінити можна будь-коли.
        </p>
        {options}
        {/* No confirmation: there is nothing here to lose. */}
        <button className={styles.commitAction} type="button" onClick={() => onApply(selected)}>
          Створити структуру
        </button>
      </div>
    );
  }

  return (
    <details className={styles.structureReplace}>
      <summary>
        Замінити структуру
        <Icon className={styles.courseSettingsAdvancedGlyph} name="chevron-down" size={18} />
      </summary>
      <div className={styles.structureReplaceBody}>
        <p className={styles.fieldHint}>
          Замінює всі модулі й уроки. Назва, обкладинка та доступ залишаться.
        </p>
        {options}
        {confirming ? (
          <div className={styles.confirmRow}>
            <span className={styles.confirmText}>Замінити поточну структуру?</span>
            <button className={styles.quietAction} type="button" onClick={() => setConfirming(false)}>
              Ні
            </button>
            <button
              className={styles.dangerAction}
              type="button"
              onClick={() => {
                onApply(selected);
                setConfirming(false);
              }}
            >
              Замінити
            </button>
          </div>
        ) : (
          <button className={styles.quietAction} type="button" onClick={() => setConfirming(true)}>
            Замінити структуру…
          </button>
        )}
      </div>
    </details>
  );
}
