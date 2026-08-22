"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { Icon } from "@/components/Icon";
import {
  inlineToPlainText,
  moveItem,
  newLesson,
  newModule,
  nextDayIndex,
  renumber,
  uniqueSlug,
  type Course,
  type CourseModule,
} from "@/lms-core";
import { BuilderFailureNotice, BuilderNotice, BuilderShell } from "./BuilderShell";
import { BuilderMenu } from "./BuilderMenu";
import { BuilderSheet } from "./BuilderSheet";
import { BuilderCourseSettings } from "./BuilderCourseSettings";
import { BuilderBlockers } from "./BuilderBlockers";
import { loadCourse, saveCourse, type BuilderCourseDto, type BuilderFailure } from "./builderClient";
import { writePath } from "./blockFields";
import styles from "./Builder.module.css";

type State =
  | { status: "loading" }
  | { status: "failed"; failure: BuilderFailure; detail?: string }
  | { status: "ready"; data: BuilderCourseDto; course: Course };

const ids = () => crypto.randomUUID();

/**
 * The course page — structure, settings, readiness, publish.
 *
 * It used to be read-only: a list of lessons you could open and nothing you
 * could rearrange. Adding, deleting and reordering happens HERE rather than in
 * the lesson editor because all three are statements about the course, and the
 * editor holds one lesson — an author moving day 7 before day 6 is not editing
 * either of them.
 *
 * TWO WRITES, DELIBERATELY SEPARATE. «Зберегти» writes the structure. «Опублікувати»
 * writes the status and nothing else. Merging them would mean a publish that
 * also saved whatever half-finished edit happened to be on screen.
 */
export function BuilderCourseView({ slug }: { slug: string }) {
  const [state, setState] = useState<State>({ status: "loading" });
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const load = useCallback(async () => {
    const result = await loadCourse(slug);
    setState(
      result.ok
        ? { status: "ready", data: result.data, course: result.data.course }
        : { status: "failed", failure: result.failure, detail: result.detail }
    );
    setDirty(false);
  }, [slug]);

  useEffect(() => {
    // Guarded so switching courses cannot land a stale response, and awaiting
    // before the first setState so the effect does not cascade a render.
    let cancelled = false;
    void (async () => {
      const result = await loadCourse(slug);
      if (cancelled) return;
      setState(
        result.ok
          ? { status: "ready", data: result.data, course: result.data.course }
          : { status: "failed", failure: result.failure, detail: result.detail }
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  // The browser's own guard, same as the lesson editor: an author who
  // rearranges a course and then reloads should be asked first.
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const editCourse = useCallback((path: (string | number)[], value: unknown) => {
    setState((current) => {
      if (current.status !== "ready") return current;
      return { ...current, course: normalize(writePath(current.course, path, value)) };
    });
    setDirty(true);
    setNote(null);
  }, []);

  /**
   * Replaces the module list wholesale, then re-derives `order`.
   *
   * `order` only. Day numbers are NOT touched — `dayIndex` is a claim about
   * which day of the programme a lesson belongs to, not about its position:
   * way21 runs 1, 2, 3, 4, 7, because twenty-one days hold fewer than
   * twenty-one lessons. An earlier pass renumbered them contiguously here, and
   * one press of a reorder arrow would have moved every reminder already
   * scheduled against those numbers.
   */
  const editModules = useCallback((next: (course: Course) => CourseModule[]) => {
    setState((current) => {
      if (current.status !== "ready") return current;
      return { ...current, course: { ...current.course, modules: renumber(next(current.course)) } };
    });
    setDirty(true);
    setNote(null);
  }, []);

  async function save() {
    if (state.status !== "ready" || busy) return;
    setBusy(true);
    setNote(null);

    const result = await saveCourse(slug, state.course);
    setBusy(false);

    if (!result.ok) {
      // Kept verbatim: a validation code names the exact place that is wrong.
      setNote(result.detail ?? "Не вдалося зберегти. Спробуйте ще раз.");
      return;
    }

    setDirty(false);
    // Reloaded rather than patched: the server bumps `version` and re-derives
    // readiness, and a screen that kept the old copy would show a blocker list
    // that no longer matches what is stored.
    await load();
    setNote(
      result.data.blockers.length === 0
        ? "Збережено. Блокерів немає."
        : `Збережено. Лишилось блокерів: ${result.data.blockers.length}.`
    );
  }

  /**
   * Publishing is a status change and nothing else — it does not save edits.
   *
   * The gate lives in `writeCourseStructure`, so a course with blockers is
   * refused by the server rather than by a disabled button here. The button is
   * disabled anyway, because a control that exists only to be rejected is a
   * worse explanation than a sentence saying what is missing.
   */
  async function setStatus(next: "draft" | "published") {
    if (state.status !== "ready" || busy) return;
    setBusy(true);
    setNote(null);

    // The STORED course, not the edited one: publishing an unsaved draft would
    // make the button a second, silent save with a different gate.
    const result = await saveCourse(slug, { ...state.data.course, status: next });
    setBusy(false);

    if (!result.ok) {
      setNote(result.detail ?? "Не вдалося зберегти. Спробуйте ще раз.");
      return;
    }

    setNote(next === "published" ? "Опубліковано в базі." : "Переведено в чернетку.");
    await load();
  }

  const trail = [{ label: "Курси", href: "/build" }];

  if (state.status === "loading") {
    return (
      <BuilderShell trail={trail}>
        <BuilderNotice title="Завантажуємо курс…" />
      </BuilderShell>
    );
  }

  if (state.status === "failed") {
    return (
      <BuilderShell trail={trail}>
        <BuilderFailureNotice failure={state.failure} detail={state.detail} />
      </BuilderShell>
    );
  }

  const { course } = state;
  const { readiness } = state.data;
  const published = state.data.course.status === "published";
  const lessonCount = course.modules.reduce((total, module) => total + module.lessons.length, 0);

  return (
    <BuilderShell
      trail={[...trail, { label: course.slug }]}
      tools={
        <button
          className={styles.menuTrigger}
          type="button"
          aria-label="Налаштування курсу"
          aria-expanded={settingsOpen}
          onClick={() => setSettingsOpen(true)}
        >
          <Icon name="settings" size={18} />
        </button>
      }
    >
      {/* Settings live behind the gear, not in the page. They are entered
          deliberately and changed rarely; in the flow they cost every visit a
          scroll past the entitlement codes to reach the lesson list. */}
      <BuilderSheet open={settingsOpen} title="Налаштування курсу" onClose={() => setSettingsOpen(false)}>
        <BuilderCourseSettings course={course} onChange={editCourse} />
      </BuilderSheet>

      <div>
        <div className={styles.courseTitleRow}>
          <h1 className={styles.pageTitle}>{course.title}</h1>
          <span className={published ? styles.pillPublished : styles.pill}>
            {published ? "Опубліковано" : "Чернетка"}
          </span>
        </div>
        {course.summary ? <p className={styles.pageLead}>{inlineToPlainText(course.summary)}</p> : null}
      </div>

      <BuilderBlockers blockers={readiness.blockers} />

      <section className={styles.panel}>
        <h2 className={styles.panelTitle}>Публікація</h2>
        {/* This said the opposite until 2026-08-21, and it was true then: the
            learner app read files, so a publish reached nobody without a
            deploy. The database is the source now (src/lib/lms/liveCatalog.ts)
            and the sentence has to say so — an author who believes their work
            is live when it is not is the worst state this panel can produce. */}
        <p className={styles.panelText}>
          Публікація відкриває курс учням одразу — застосунок читає курси з бази. Файл у репозиторії
          лишається знімком, з якого платформа читає, якщо база не відповість; оновити його —{" "}
          <code>npm run lms:pull -- {course.slug}</code>.
        </p>
        {readiness.ready ? null : (
          <p className={styles.panelText}>
            Опублікувати не вийде, доки лишаються блокери — це та сама перевірка, яку проходить сид.
          </p>
        )}
        {dirty ? (
          <p className={styles.panelText}>
            Публікація стосується збереженого стану. Незбережені зміни структури спершу треба зберегти.
          </p>
        ) : null}
        <div className={styles.panelActions}>
          <span className={styles.panelStatus}>{published ? "Курс відкритий учням" : "Курс у роботі"}</span>
          {published ? (
            <button className={styles.retreatAction} type="button" onClick={() => setStatus("draft")} disabled={busy}>
              Зняти з публікації
            </button>
          ) : (
            <button
              className={styles.commitAction}
              type="button"
              onClick={() => setStatus("published")}
              disabled={busy || !readiness.ready}
            >
              Опублікувати
            </button>
          )}
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHead}>
          <h2 className={styles.panelTitle}>Структура</h2>
          <span className={styles.courseMeta}>
            {course.modules.length} {plural(course.modules.length, "модуль", "модулі", "модулів")} ·{" "}
            {lessonCount} {plural(lessonCount, "урок", "уроки", "уроків")}
          </span>
        </div>

        {course.modules.map((module, moduleIndex) => (
          <ModuleEditor
            key={module.id}
            course={course}
            module={module}
            moduleIndex={moduleIndex}
            onChange={editCourse}
            onModules={editModules}
            onNote={setNote}
          />
        ))}

        <button
          className={styles.addAction}
          type="button"
          onClick={() =>
            editModules((current) => [
              ...current.modules,
              newModule(ids, { order: current.modules.length + 1, title: `Модуль ${current.modules.length + 1}` }),
            ])
          }
        >
          <span className={styles.addGlyph} aria-hidden="true">+</span> Додати модуль
        </button>
      </section>

      <div className={styles.saveBar}>
        <span className={styles.saveState}>{note ?? (dirty ? "Є незбережені зміни" : "Змін немає")}</span>
        <button className={styles.commitAction} type="button" onClick={save} disabled={busy || !dirty}>
          {busy ? "Зберігаємо…" : "Зберегти"}
        </button>
      </div>
    </BuilderShell>
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
function normalize(course: Course): Course {
  if (course.cover && !course.cover.src) {
    const next = { ...course };
    delete next.cover;
    return next;
  }
  return course;
}

function ModuleEditor({
  course,
  module,
  moduleIndex,
  onChange,
  onModules,
  onNote,
}: {
  course: Course;
  module: CourseModule;
  moduleIndex: number;
  onChange: (path: (string | number)[], value: unknown) => void;
  onModules: (next: (course: Course) => CourseModule[]) => void;
  onNote: (note: string | null) => void;
}) {
  const isOnlyModule = course.modules.length === 1;

  /**
   * Moves a lesson, ACROSS module boundaries when it is at an edge.
   *
   * Pressing "down" on the last lesson of a module means "put it in the next
   * one" — that is where the author is looking and it is the move a course
   * actually needs when a week grows by a day. Stopping at the boundary would
   * make regrouping lessons impossible without deleting and retyping them.
   */
  const moveLesson = (lessonIndex: number, delta: number) => {
    onModules((current) => {
      const modules = current.modules.map((entry) => ({ ...entry, lessons: [...entry.lessons] }));
      const from = modules[moduleIndex];
      const target = lessonIndex + delta;

      if (target >= 0 && target < from.lessons.length) {
        from.lessons = moveItem(from.lessons, lessonIndex, target);
        return modules;
      }

      const neighbourIndex = moduleIndex + delta;
      if (neighbourIndex < 0 || neighbourIndex >= modules.length) return modules;
      // A module cannot be emptied by a move: `validateCourse` requires at
      // least one lesson in each, and the author would find out at save time.
      if (from.lessons.length === 1) return modules;

      const [moved] = from.lessons.splice(lessonIndex, 1);
      const neighbour = modules[neighbourIndex];
      neighbour.lessons.splice(delta > 0 ? 0 : neighbour.lessons.length, 0, moved);
      return modules;
    });
  };

  const deleteLesson = (lessonIndex: number) => {
    if (module.lessons.length === 1) {
      onNote("Останній урок модуля не видаляється — видаліть модуль цілком.");
      return;
    }
    onModules((current) =>
      current.modules.map((entry, index) =>
        index === moduleIndex
          ? { ...entry, lessons: entry.lessons.filter((_, position) => position !== lessonIndex) }
          : entry
      )
    );
  };

  return (
    <div className={styles.moduleBlock}>
      <div className={styles.moduleHead}>
        <input
          className={styles.moduleTitleInput}
          type="text"
          value={module.title}
          aria-label={`Назва модуля ${moduleIndex + 1}`}
          onChange={(event) => onChange(["modules", moduleIndex, "title"], event.target.value)}
        />
        <BuilderMenu
          label={`Дії з модулем «${module.title}»`}
          items={[
            {
              label: "Підняти вище",
              disabled: moduleIndex === 0,
              onSelect: () => onModules((current) => moveItem(current.modules, moduleIndex, moduleIndex - 1)),
            },
            {
              label: "Опустити нижче",
              disabled: moduleIndex === course.modules.length - 1,
              onSelect: () => onModules((current) => moveItem(current.modules, moduleIndex, moduleIndex + 1)),
            },
            {
              label: "Видалити модуль",
              danger: true,
              // The last module cannot go: `validateCourse` requires one, and
              // the author would meet that as a save error instead of a
              // disabled item.
              disabled: isOnlyModule,
              onSelect: () => onModules((current) => current.modules.filter((_, index) => index !== moduleIndex)),
            },
          ]}
        />
      </div>

      {/* Reference material is not a step. A module marked here leaves the
          numbered flow, stops counting toward completion and loses its day
          numbers — a recipe list is not "day 4". */}
      <label className={styles.moduleFlag}>
        <input
          type="checkbox"
          checked={module.reference === true}
          onChange={(event) =>
            onChange(["modules", moduleIndex, "reference"], event.target.checked || undefined)
          }
        />{" "}
        Довідковий модуль — поза послідовністю уроків
      </label>

      {module.lessons.map((lesson, lessonIndex) => (
        <div className={styles.lessonRowWrap} key={lesson.id}>
          <Link className={styles.lessonRow} href={`/build/${course.slug}/${lesson.slug}`}>
            <span className={styles.lessonName}>{lesson.title}</span>
            <span className={styles.lessonMeta}>
              {lesson.dayIndex ? `День ${lesson.dayIndex} · ` : ""}
              {lesson.blocks.length} {plural(lesson.blocks.length, "блок", "блоки", "блоків")}
            </span>
          </Link>
          <BuilderMenu
            label={`Дії з уроком «${lesson.title}»`}
            items={[
              {
                label: "Підняти вище",
                disabled: moduleIndex === 0 && lessonIndex === 0,
                onSelect: () => moveLesson(lessonIndex, -1),
              },
              {
                label: "Опустити нижче",
                disabled: moduleIndex === course.modules.length - 1 && lessonIndex === module.lessons.length - 1,
                onSelect: () => moveLesson(lessonIndex, 1),
              },
              { label: "Видалити урок", danger: true, onSelect: () => deleteLesson(lessonIndex) },
            ]}
          />
        </div>
      ))}

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
            })
          )
        }
      >
        <span className={styles.addGlyph} aria-hidden="true">+</span> Додати урок
      </button>
    </div>
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
