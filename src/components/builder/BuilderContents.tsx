"use client";

/**
 * The course's structure, as navigation.
 *
 * ONE component, two presentations: a rail beside the editor on a desk, the
 * same node as a drawer below 901px. Two lists would be two places to fix a
 * bug and two chances for them to disagree about which lesson is current.
 *
 * The rail owns the operations that preserve editing context: expand/collapse,
 * open a lesson, append a lesson or module — and, when the editor hands it an
 * `edit` contract, reorder and delete. That last part is not a duplicate of the
 * course workspace. An author restructuring a course does it WHILE reading the
 * lessons, and sending them out to another screen to move one lesson up meant
 * leaving the thing they were judging it against. The arithmetic is shared with
 * that screen (see structureMoves.ts) precisely so the two surfaces cannot
 * drift into disagreeing about what a move means.
 */

import { useState } from "react";

import { Icon } from "@/components/Icon";
import type { Course, CourseModule } from "@/lms-core";
import { BuilderGrip } from "./BuilderGrip";
import { BuilderMenu } from "./BuilderMenu";
import { InkLabel } from "./BuilderInkLabel";
import {
  LAST_LESSON_REFUSAL,
  moveLessonTo,
  moveModuleTo,
  removeLesson,
  removeModule,
  stepLesson,
  stepModule,
} from "./structureMoves";
import { useRowDrag, type DragRef, type DropEdge } from "./useRowDrag";
import styles from "./Builder.module.css";

/**
 * What the outline needs in order to restructure rather than only navigate.
 *
 * Optional as a whole: a surface that only reads the structure passes nothing
 * and gets no grips and no menus, rather than getting controls that quietly do
 * nothing.
 */
export type ContentsEditing = {
  /** Applies a whole-modules replacement, and owns undo and renumbering. */
  onModules: (next: (course: Course) => CourseModule[]) => void;
  /** Says a refusal out loud — see LAST_LESSON_REFUSAL. */
  onNote: (note: string) => void;
  /**
   * Called with where to go BEFORE the lesson currently open is removed.
   *
   * The outline cannot navigate itself out of the way afterwards: the moment
   * the open lesson leaves the course the editor has no lesson to render, and
   * an author who deleted a lesson would be looking at «Урок не знайдено»
   * instead of at the one beside it. The editor answers this because it is the
   * only part that knows how to leave a lesson safely.
   */
  onLeaveCurrent: (href: string) => void;
};

export function BuilderContents({
  course,
  currentSlug,
  onNavigate,
  onAddLesson,
  onAddModule,
  editing,
}: {
  course: Course;
  currentSlug?: string;
  onNavigate: (href: string) => void;
  onAddLesson?: (moduleId: string) => void;
  onAddModule?: () => void;
  editing?: ContentsEditing;
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());

  const toggleModule = (moduleId: string) => {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(moduleId)) next.delete(moduleId);
      else next.add(moduleId);
      return next;
    });
  };

  const moduleDrag = useRowDrag((from: DragRef, to: DragRef, edge: DropEdge) => {
    editing?.onModules((current) => moveModuleTo(current.modules, from, to, edge));
  });

  const lessonDrag = useRowDrag(
    (from: DragRef, to: DragRef, edge: DropEdge) => {
      editing?.onModules((current) => moveLessonTo(current.modules, from, to, edge));
    },
    { crossGroup: true }
  );

  /**
   * Where the editor should go when the lesson it is showing is about to leave.
   *
   * The lesson before it, or the one after when it was first: an author's next
   * glance after removing a step is at the step around it, not at the top of
   * the course.
   */
  const neighbourHref = (moduleIndex: number, lessonIndex: number) => {
    const walk = course.modules.flatMap((entry) => entry.lessons);
    const flatIndex =
      course.modules.slice(0, moduleIndex).reduce((total, entry) => total + entry.lessons.length, 0) + lessonIndex;
    const neighbour = walk[flatIndex - 1] ?? walk[flatIndex + 1];
    return neighbour ? `/build/${course.slug}/${neighbour.slug}` : `/build/${course.slug}`;
  };

  /** True when what is about to be removed contains the lesson on screen. */
  const holdsCurrent = (lessons: { slug: string }[]) =>
    currentSlug !== undefined && lessons.some((lesson) => lesson.slug === currentSlug);

  return (
    <nav className={styles.contentsPanel} aria-label="Уроки курсу">
      <div className={styles.contentsHeader}>
        <button className={styles.contentsBack} type="button" onClick={() => onNavigate(`/build/${course.slug}`)}>
          <Icon name="arrow-left" size={18} />
          <InkLabel>Структура курсу</InkLabel>
        </button>
      </div>

      <div className={styles.contentsTree}>
        {course.modules.map((entry, moduleIndex) => {
          const closed = collapsed.has(entry.id);
          const moduleLabel = entry.reference
            ? entry.title
            : /^модуль\s*\d+/i.test(entry.title.trim())
              ? entry.title
              : `Модуль ${moduleIndex + 1}. ${entry.title}`;
          const moduleRow: DragRef = { list: "outline-module", group: 0, index: moduleIndex };
          return (
            <section
              className={`${styles.contentsGroup} ${styles.dragRow}`}
              key={entry.id}
              {...(editing ? moduleDrag.rowProps(moduleRow) : {})}
            >
              <div className={styles.contentsModuleRow}>
                {editing ? (
                  <BuilderGrip drag={moduleDrag} row={moduleRow} label={moduleLabel} />
                ) : (
                  <Icon name="grip" size={16} />
                )}
                <button className={styles.contentsModuleToggle} type="button" aria-expanded={!closed} onClick={() => toggleModule(entry.id)}>
                  <Icon name={closed ? "chevron-right" : "chevron-down"} size={16} />
                  <InkLabel>{moduleLabel}</InkLabel>
                </button>
                {editing ? (
                  <BuilderMenu
                    label={`Дії з модулем «${entry.title}»`}
                    items={[
                      {
                        label: "Підняти вище",
                        icon: "arrow-up",
                        disabled: moduleIndex === 0,
                        onSelect: () =>
                          editing.onModules((current) => stepModule(current.modules, moduleIndex, -1) ?? current.modules),
                      },
                      {
                        label: "Опустити нижче",
                        icon: "arrow-down",
                        disabled: moduleIndex === course.modules.length - 1,
                        onSelect: () =>
                          editing.onModules((current) => stepModule(current.modules, moduleIndex, 1) ?? current.modules),
                      },
                      {
                        label: "Видалити модуль",
                        icon: "trash",
                        danger: true,
                        // The last module cannot go: `validateCourse` requires
                        // one, and the author would meet that as a save error
                        // instead of a disabled item.
                        disabled: course.modules.length === 1,
                        onSelect: () => {
                          // Leave FIRST. Removing the module the open lesson
                          // lives in would otherwise leave the editor with
                          // nothing to render.
                          if (holdsCurrent(entry.lessons)) editing.onLeaveCurrent(neighbourHref(moduleIndex, 0));
                          editing.onModules((current) => removeModule(current.modules, moduleIndex) ?? current.modules);
                        },
                      },
                    ]}
                  />
                ) : null}
              </div>
              {!closed ? (
                <div className={styles.contentsLessons}>
                  {entry.lessons.map((item, lessonIndex) => {
                    const lessonRow: DragRef = { list: "outline-lesson", group: moduleIndex, index: lessonIndex };
                    return (
                      <div
                        className={`${styles.contentsRow} ${styles.dragRow}`}
                        key={item.id}
                        {...(editing ? lessonDrag.rowProps(lessonRow) : {})}
                      >
                        {/* Leading, like the module's own grip: the thing you
                            pick a row up by is in the same place on every row
                            of this list. */}
                        {editing ? <BuilderGrip drag={lessonDrag} row={lessonRow} label={item.title} /> : null}
                        {/* AN ANCHOR, because this is the list an author opens
                            lessons from, and a real address is what makes the
                            browser's own menu — open in a new tab, copy the
                            link — mean something. A plain left click is taken
                            over so the editor can switch in place; every
                            modified click is left to the browser. */}
                        <a
                          className={styles.contentsLink}
                          href={`/build/${course.slug}/${item.slug}`}
                          aria-current={item.slug === currentSlug ? "page" : undefined}
                          title={item.title}
                          onClick={(event) => {
                            if (event.defaultPrevented || event.button !== 0) return;
                            if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                            event.preventDefault();
                            onNavigate(`/build/${course.slug}/${item.slug}`);
                          }}
                        >
                          {/* No page glyph. Every row in a course outline is a
                              lesson, so an icon that says «lesson» on all of
                              them says nothing — it was a column of filler
                              between the grip and the number. */}
                          <span className={styles.contentsLessonOrdinal}>{String(lessonIndex + 1).padStart(2, "0")}</span>
                          <InkLabel className={styles.lessonName}>{item.title}</InkLabel>
                        </a>
                        {editing ? (
                          <BuilderMenu
                              label={`Дії з уроком «${item.title}»`}
                              /* The row keeps the browser's own context menu.
                                 Elsewhere the right click is the fast path to
                                 these actions, but this list is how an author
                                 OPENS lessons, and «відкрити в новій вкладці»
                                 on a lesson is worth more than a second way
                                 into a menu whose button is on the row. */
                              contextArea={false}
                              items={[
                                {
                                  label: "Підняти вище",
                                  icon: "arrow-up",
                                  onSelect: () =>
                                    editing.onModules(
                                      (current) => stepLesson(current.modules, moduleIndex, lessonIndex, -1) ?? current.modules
                                    ),
                                },
                                {
                                  label: "Опустити нижче",
                                  icon: "arrow-down",
                                  onSelect: () =>
                                    editing.onModules(
                                      (current) => stepLesson(current.modules, moduleIndex, lessonIndex, 1) ?? current.modules
                                    ),
                                },
                                {
                                  label: "Видалити урок",
                                  icon: "trash",
                                  danger: true,
                                  disabled: entry.lessons.length === 1,
                                  hint: entry.lessons.length === 1 ? LAST_LESSON_REFUSAL : undefined,
                                  onSelect: () => {
                                    if (item.slug === currentSlug) editing.onLeaveCurrent(neighbourHref(moduleIndex, lessonIndex));
                                    editing.onModules((current) => {
                                      const next = removeLesson(current.modules, moduleIndex, lessonIndex);
                                      if (!next) {
                                        editing.onNote(LAST_LESSON_REFUSAL);
                                        return current.modules;
                                      }
                                      return next;
                                    });
                                  },
                                },
                            ]}
                          />
                        ) : null}
                      </div>
                    );
                  })}
                  {onAddLesson ? (
                    <button className={styles.contentsAdd} type="button" onClick={() => onAddLesson(entry.id)}>
                      <Icon name="plus" size={18} /> Додати урок
                    </button>
                  ) : null}
                </div>
              ) : null}
            </section>
          );
        })}
      </div>
      {onAddModule ? (
        <button className={styles.contentsAddModule} type="button" onClick={onAddModule}>
          <Icon name="plus" size={18} /> Додати модуль
        </button>
      ) : null}
    </nav>
  );
}
