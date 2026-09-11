"use client";

/**
 * One module of the course, editable, with the rail and the labels beside it.
 *
 * Split out of BuilderCourseView.tsx (1,458 lines) on 2026-09-11; nothing inside any declaration changed.
 */

import { useRef, useState } from "react";
import { HandGraphic, Icon } from "@/components/Icon";
import { newLesson, nextDayIndex, uniqueSlug, type Course, type CourseModule, type Lesson } from "@/lms-core";
import type { LessonDocumentFormat } from "@/lib/lms/lessonDocuments";
import { plural } from "@/lib/plural";
import { BuilderMenu } from "./BuilderMenu";
import type { WorkspaceMode } from "./courseWorkspace";
import type { BuilderCourseDto } from "./builderClient";
import { BuilderGrip } from "./BuilderGrip";
import { BuilderEditableTitle } from "./BuilderEditableTitle";
import type { DragRef, RowDrag } from "./useRowDrag";
import { LAST_LESSON_REFUSAL, removeLesson, removeModule, stepLesson, stepModule } from "./structureMoves";
import styles from "./Builder.module.css";
import { ids, trailTitle } from "./BuilderCourseView";

export function BuilderCourseRail({
  published,
  blockerCount,
  activeMode,
  onMode,
}: {
  published: boolean;
  blockerCount: number;
  activeMode: WorkspaceMode;
  onMode: (mode: WorkspaceMode) => void;
}) {
  return (
    <div className={styles.courseRail}>
      <nav className={styles.courseRailNav} aria-label="Розділи курсу">
        <a
          className={styles.courseRailLink}
          href="#course-overview"
          aria-label="Обкладинка"
          aria-current={activeMode === "course" ? "page" : undefined}
          onClick={(event) => {
            event.preventDefault();
            onMode("course");
          }}
        >
          <span className={styles.courseRailIcon}>
            <Icon name="display" size={20} />
            <HandGraphic className={styles.iconInkRing} name="ink-ring" size={42} />
          </span>
          <BuilderInkLabel>Обкладинка</BuilderInkLabel>
        </a>
        <a
          className={styles.courseRailLink}
          href="#course-structure"
          aria-label="Зміст"
          aria-current={activeMode === "content" ? "page" : undefined}
          onClick={(event) => {
            event.preventDefault();
            onMode("content");
          }}
        >
          <span className={styles.courseRailIcon}>
            <Icon name="view-rows" size={20} />
            <HandGraphic className={styles.iconInkRing} name="ink-ring" size={42} />
          </span>
          <BuilderInkLabel>Зміст</BuilderInkLabel>
        </a>
        <a
          className={styles.courseRailLink}
          href="#course-offer"
          aria-label="Сторінка програми"
          aria-current={activeMode === "offer" ? "page" : undefined}
          onClick={(event) => {
            event.preventDefault();
            onMode("offer");
          }}
        >
          <span className={styles.courseRailIcon}>
            <Icon name="document" size={20} />
            <HandGraphic className={styles.iconInkRing} name="ink-ring" size={42} />
          </span>
          <BuilderInkLabel>Сторінка</BuilderInkLabel>
        </a>
        <a
          className={styles.courseRailLink}
          href="#course-author"
          aria-label="Автор"
          aria-current={activeMode === "author" ? "page" : undefined}
          onClick={(event) => {
            event.preventDefault();
            onMode("author");
          }}
        >
          <span className={styles.courseRailIcon}>
            <Icon name="user" size={20} />
            <HandGraphic className={styles.iconInkRing} name="ink-ring" size={42} />
          </span>
          <BuilderInkLabel>Автор</BuilderInkLabel>
        </a>
        <a
          className={styles.courseRailLink}
          href="#course-release"
          aria-label="Публікація"
          aria-current={activeMode === "release" ? "page" : undefined}
          onClick={(event) => {
            event.preventDefault();
            onMode("release");
          }}
        >
          <span className={styles.courseRailIcon}>
            <Icon name="shield-check" size={20} />
            <HandGraphic className={styles.iconInkRing} name="ink-ring" size={42} />
          </span>
          <BuilderInkLabel>Публікація</BuilderInkLabel>
        </a>
      </nav>
      <div className={styles.courseRailStatus}>
        <span className={styles.courseRailStatusLine}>
          <HandGraphic className={styles.courseRailStatusDot} name="dot" size={12} />
          {published ? "Опубліковано" : "Чернетка"}
        </span>
        <span className={styles.courseRailStatusLine}>
          <HandGraphic className={styles.courseRailStatusDotBoundary} name="dot" size={12} />
          {blockerCount} {plural(blockerCount, "блокер", "блокери", "блокерів")}
        </span>
      </div>
    </div>
  );
}

export function BuilderInkLabel({ children }: { children: string }) {
  return (
    <span className={styles.inkLabel}>
      {children}
      <HandGraphic className={styles.inkMark} name="ink-stroke" size={36} />
    </span>
  );
}

/**
 * A course whose optional objects were emptied field by field.
 *
 * `cover` is written through two separate inputs, so an author who clears both
 * leaves `{}` behind — a shape the validator rejects with
 * `lms_course_cover_missing_src` at save time, long after the field that caused
 * it went off screen. Cleared here instead, where the cause is one keystroke old.
 */
export function normalize(course: Course): Course {
  if (course.cover && !course.cover.src) {
    const next = { ...course };
    delete next.cover;
    return next;
  }
  return course;
}

export function ModuleEditor({
  course,
  module,
  moduleIndex,
  moduleDrag,
  lessonDrag,
  onChange,
  onModules,
  onNote,
  onOpenLesson,
  busy,
  onImportLessons,
  onExportLesson,
}: {
  course: Course;
  module: CourseModule;
  moduleIndex: number;
  moduleDrag: RowDrag;
  lessonDrag: RowDrag;
  onChange: (path: (string | number)[], value: unknown) => void;
  onModules: (next: (course: Course) => CourseModule[]) => void;
  onNote: (note: string) => void;
  /** Answers whether the row may follow its own href, or is being held back. */
  onOpenLesson: (href: string) => "allow" | "held";
  busy: boolean;
  onImportLessons: (files: File[]) => Promise<void>;
  onExportLesson: (lesson: Lesson, format: LessonDocumentFormat) => Promise<void>;
}) {
  const isOnlyModule = course.modules.length === 1;
  const importPicker = useRef<HTMLInputElement>(null);
  const [collapsed, setCollapsed] = useState(false);
  const sequenceIndex = module.reference
    ? null
    : course.modules.slice(0, moduleIndex + 1).filter((entry) => entry.reference !== true).length;
  const collapsedPreview = module.lessons
    .slice(0, 2)
    .map((lesson) => trailTitle(lesson.title, "Урок без назви"))
    .join(" · ");

  const moveLesson = (lessonIndex: number, delta: number) => {
    onModules((current) => stepLesson(current.modules, moduleIndex, lessonIndex, delta) ?? current.modules);
  };

  const deleteLesson = (lessonIndex: number) => {
    onModules((current) => {
      const next = removeLesson(current.modules, moduleIndex, lessonIndex);
      if (!next) {
        onNote(LAST_LESSON_REFUSAL);
        return current.modules;
      }
      return next;
    });
  };

  const moduleRow: DragRef = { list: "module", group: 0, index: moduleIndex };

  return (
    <div
      className={`${styles.moduleBlock} ${styles.dragRow}`}
      /* The rail reads this: a reference module is outside the sequence, so it
         gets a dash on the path instead of the next number, and the numbers
         after it do not skip. */
      data-reference={module.reference === true ? "" : undefined}
      data-collapsed={collapsed ? "" : undefined}
      {...moduleDrag.rowProps(moduleRow)}
    >
      <div className={styles.moduleHead}>
        <BuilderGrip drag={moduleDrag} row={moduleRow} label={module.title} />
        <span
          className={styles.moduleOrdinal}
          data-short-label={sequenceIndex === null ? "Дов." : String(sequenceIndex).padStart(2, "0")}
          aria-hidden="true"
        >
          {sequenceIndex === null ? "Довідка" : `Модуль ${String(sequenceIndex).padStart(2, "0")}`}
        </span>
        <button
          className={styles.moduleCollapse}
          type="button"
          aria-label={collapsed ? `Розгорнути модуль «${module.title}»` : `Згорнути модуль «${module.title}»`}
          aria-expanded={!collapsed}
          onClick={() => setCollapsed((current) => !current)}
        >
          <Icon name={collapsed ? "chevron-right" : "chevron-down"} size={18} />
        </button>
        <BuilderEditableTitle
          compact
          register="record"
          level="h3"
          value={module.title}
          label={`Редагувати назву модуля ${moduleIndex + 1}`}
          onChange={(value) => onChange(["modules", moduleIndex, "title"], value)}
        />
        <span className={styles.moduleLessonCount}>
          {module.lessons.length} {plural(module.lessons.length, "урок", "уроки", "уроків")}
        </span>
        <BuilderMenu
          label={`Дії з модулем «${module.title}»`}
          items={[
            {
              label: "Підняти вище",
              icon: "arrow-up",
              disabled: moduleIndex === 0,
              onSelect: () => onModules((current) => stepModule(current.modules, moduleIndex, -1) ?? current.modules),
            },
            {
              label: "Опустити нижче",
              icon: "arrow-down",
              disabled: moduleIndex === course.modules.length - 1,
              onSelect: () => onModules((current) => stepModule(current.modules, moduleIndex, 1) ?? current.modules),
            },
            {
              label: module.reference ? "Повернути в послідовність" : "Зробити довідковим",
              icon: "question",
              onSelect: () => onChange(["modules", moduleIndex, "reference"], module.reference ? undefined : true),
            },
            {
              label: "Видалити модуль",
              icon: "trash",
              danger: true,
              // The last module cannot go: `validateCourse` requires one, and
              // the author would meet that as a save error instead of a
              // disabled item.
              disabled: isOnlyModule,
              onSelect: () => onModules((current) => removeModule(current.modules, moduleIndex) ?? current.modules),
            },
          ]}
        />
      </div>

      {collapsed ? (
        <p className={styles.moduleCollapsedPreview}>
          {collapsedPreview}
          {module.lessons.length > 2 ? ` · ще ${module.lessons.length - 2}` : ""}
        </p>
      ) : null}

      {collapsed ? null : (
        <>
          <div className={styles.lessonList}>
            {module.lessons.map((lesson, lessonIndex) => {
              const lessonRow: DragRef = { list: "lesson", group: moduleIndex, index: lessonIndex };
              return (
                <div
                  className={`${styles.lessonRowWrap} ${styles.dragRow}`}
                  key={lesson.id}
                  {...lessonDrag.rowProps(lessonRow)}
                >
                  <BuilderGrip drag={lessonDrag} row={lessonRow} label={lesson.title} />
                  <div className={styles.lessonRow}>
                    <span
                      className={styles.lessonOrdinal}
                      data-short-label={String(lessonIndex + 1).padStart(2, "0")}
                      aria-hidden="true"
                    >
                      {sequenceIndex === null
                        ? String(lessonIndex + 1).padStart(2, "0")
                        : `${String(sequenceIndex).padStart(2, "0")}.${String(lessonIndex + 1).padStart(2, "0")}`}
                    </span>
                    <Icon className={styles.lessonIcon} name="document" size={20} />
                    <span className={styles.lessonText}>
                      <BuilderEditableTitle
                        compact
                        level="h4"
                        value={lesson.title}
                        label={`Редагувати назву уроку ${lessonIndex + 1}`}
                        href={`/build/${course.slug}/${lesson.slug}`}
                        onLinkClick={(event) => {
                          if (onOpenLesson(`/build/${course.slug}/${lesson.slug}`) === "held") event.preventDefault();
                        }}
                        onChange={(value) => onChange(["modules", moduleIndex, "lessons", lessonIndex, "title"], value)}
                      />
                      <span className={styles.lessonMeta}>
                        {lesson.dayIndex ? `День ${lesson.dayIndex} · ` : ""}
                        {lesson.blocks.length} {plural(lesson.blocks.length, "блок", "блоки", "блоків")}
                      </span>
                    </span>
                  </div>
                  <BuilderMenu
                    label={`Дії з уроком «${lesson.title}»`}
                    items={[
                      {
                        label: "Підняти вище",
                        icon: "arrow-up",
                        disabled: moduleIndex === 0 && lessonIndex === 0,
                        onSelect: () => moveLesson(lessonIndex, -1),
                      },
                      {
                        label: "Опустити нижче",
                        icon: "arrow-down",
                        disabled:
                          moduleIndex === course.modules.length - 1 && lessonIndex === module.lessons.length - 1,
                        onSelect: () => moveLesson(lessonIndex, 1),
                      },
                      {
                        label: "Експортувати Markdown",
                        disabled: busy,
                        onSelect: () => void onExportLesson(lesson, "md"),
                      },
                      {
                        label: "Експортувати Word",
                        disabled: busy,
                        onSelect: () => void onExportLesson(lesson, "docx"),
                      },
                      {
                        label: "Експортувати текст",
                        disabled: busy,
                        onSelect: () => void onExportLesson(lesson, "txt"),
                      },
                      {
                        label: "Видалити урок",
                        icon: "trash" as const,
                        danger: true,
                        onSelect: () => deleteLesson(lessonIndex),
                      },
                    ]}
                  />
                </div>
              );
            })}
          </div>

          <div className={styles.addRow}>
            <button
              className={styles.addAction}
              type="button"
              onClick={() =>
                onModules((current) =>
                  current.modules.map((entry, index) => {
                    if (index !== moduleIndex) return entry;
                    const position = entry.lessons.length + 1;
                    const title = `Урок ${position}`;
                    // Lesson slugs are unique across the WHOLE course, not the module:
                    // they are the URL key, and `validateCourse` refuses a duplicate.
                    const taken = current.modules.flatMap((one) => one.lessons.map((item) => item.slug));
                    // A daily course refuses a lesson with no day at all, so a new
                    // one takes the day after the last — never a renumber of the rest.
                    const dayIndex = entry.reference ? undefined : nextDayIndex(current);
                    return {
                      ...entry,
                      lessons: [
                        ...entry.lessons,
                        newLesson(ids, { order: position, title, slug: uniqueSlug(title, taken), dayIndex }),
                      ],
                    };
                  }),
                )
              }
            >
              <Icon name="plus" size={20} /> Новий урок
            </button>
            {/* NEXT TO THE HAND-MADE ONE, because it makes the same thing — but as
            a GLYPH, not a second sentence. Two full labels side by side read as
            two equal offers and doubled the width of a row that repeats once per
            module; on a phone they wrapped. The words belong to the one an
            author takes ten times a day, and the side door keeps a tooltip and
            an accessible name — the same split as the course list's head, where
            «Новий курс» is the gold button and import is the glyph beside it.

            `multiple` is the point of it: five files are five lessons in one
            press, appended in the order the picker returns them. */}
            <button
              className={styles.moduleImportAction}
              type="button"
              disabled={busy}
              onClick={() => importPicker.current?.click()}
              title={busy ? "Опрацьовуємо…" : "Імпортувати уроки з файлів"}
              aria-label={busy ? "Опрацьовуємо…" : "Імпортувати уроки з файлів"}
            >
              <Icon name="import" size={20} />
              <HandGraphic className={styles.stepInkRing} name="ink-ring" size={42} />
            </button>
            <input
              ref={importPicker}
              className={styles.visuallyHidden}
              type="file"
              accept=".md,.markdown,.docx,.txt,text/markdown,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              multiple
              tabIndex={-1}
              onChange={(event) => {
                const files = Array.from(event.target.files ?? []);
                /* Cleared before the work starts, so picking the same files again
               still fires a change event. */
                event.target.value = "";
                if (files.length) void onImportLessons(files);
              }}
            />
          </div>
        </>
      )}
    </div>
  );
}

export function reviewStatusLabel(data: BuilderCourseDto): string {
  if (data.course.status === "published") return "Курс відкритий учням";
  if (!data.review.enabled) return "Ручний тестовий контур";
  if (data.review.status === "approved") return "Перевірку пройдено";
  if (data.review.status === "in_review") return "На перевірці";
  if (data.review.status === "changes_requested") return "Потрібні зміни";
  return "Перевірка не розпочата";
}
