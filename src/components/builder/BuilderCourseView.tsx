"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

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
import { BuilderGrip } from "./BuilderGrip";
import { BuilderHistory } from "./BuilderHistory";
import { useCourseHistory } from "./useCourseHistory";
import { landingIndex, useRowDrag, type DragRef, type DropEdge, type RowDrag } from "./useRowDrag";
import { writePath } from "./blockFields";
import styles from "./Builder.module.css";

type State =
  | { status: "loading" }
  | { status: "failed"; failure: BuilderFailure; detail?: string }
  | { status: "ready"; data: BuilderCourseDto };

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
  const history = useCourseHistory();
  const { course, dirty } = history;
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const router = useRouter();

  const load = useCallback(async () => {
    const result = await loadCourse(slug);
    if (result.ok) history.reset(result.data.course);
    setState(
      result.ok
        ? { status: "ready", data: result.data }
        : { status: "failed", failure: result.failure, detail: result.detail }
    );
  }, [history, slug]);

  useEffect(() => {
    // Guarded so switching courses cannot land a stale response, and awaiting
    // before the first setState so the effect does not cascade a render.
    let cancelled = false;
    void (async () => {
      const result = await loadCourse(slug);
      if (cancelled) return;
      if (result.ok) history.reset(result.data.course);
      setState(
        result.ok
          ? { status: "ready", data: result.data }
          : { status: "failed", failure: result.failure, detail: result.detail }
      );
    })();
    return () => {
      cancelled = true;
    };
    // `history.reset` is stable; the course is reloaded only when the slug changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  // The browser's own guard, same as the lesson editor: an author who
  // rearranges a course and then reloads should be asked first.
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const editCourse = useCallback(
    (path: (string | number)[], value: unknown) => {
      // Coalesced by the path: retitling a module is one undo, not one per letter.
      history.edit(path.join("."), (current) => normalize(writePath(current, path, value)));
      setNote(null);
    },
    [history]
  );

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
  const editModules = useCallback(
    (next: (course: Course) => CourseModule[]) => {
      // No coalescing key — see the lesson editor: each add, delete and move is
      // its own act and gets its own step back.
      history.edit(null, (current) => ({ ...current, modules: renumber(next(current)) }));
      setNote(null);
    },
    [history]
  );

  /** Modules reorder within the course; the drop names a place in the list on screen. */
  const moduleDrag = useRowDrag(
    useCallback(
      (from: DragRef, to: DragRef, edge: DropEdge) => {
        editModules((current) => moveItem(current.modules, from.index, landingIndex(from.index, to.index, edge, true)));
      },
      [editModules]
    )
  );

  /**
   * Lessons reorder ACROSS modules, the same way the arrows already carry one
   * over a module edge. `crossGroup` is what says so; without it a lesson could
   * only be dropped among its own siblings, which is the move an author needs
   * least — the reason to pick a lesson up is usually that it belongs to
   * another week.
   */
  const lessonDrag = useRowDrag(
    useCallback(
      (from: DragRef, to: DragRef, edge: DropEdge) => {
        editModules((current) => moveLessonTo(current, from, to, edge));
      },
      [editModules]
    ),
    { crossGroup: true }
  );

  /**
   * The lesson slugs the SERVER has.
   *
   * `state.data` is the loaded response and the history's course is the working copy;
   * edits touch only the second, so this stays the stored truth until the next
   * save reloads it. It is what tells a freshly added lesson — which exists
   * only on this screen — from one an author may open.
   */
  const savedLessonSlugs = useMemo(() => {
    if (state.status !== "ready") return new Set<string>();
    return new Set(state.data.course.modules.flatMap((entry) => entry.lessons.map((lesson) => lesson.slug)));
  }, [state]);

  /**
   * Opening a lesson with the structure unsaved.
   *
   * THE BUG THIS FIXES. Every lesson row is a link, and «Додати урок» puts a
   * row on screen the moment it is pressed — with a working href to a lesson
   * that exists nowhere but this component's state. Clicking it was a
   * client-side route change, which `beforeunload` does not cover, so the
   * editor loaded the course from the server, could not find the lesson, and
   * said «Урок не знайдено» — while the addition itself was dropped. An author
   * who pressed «Додати урок» and then pressed the thing it created got a
   * dead end and lost the work.
   *
   * The lesson editor already held its own dirty navigation; the course screen
   * did not, and that is the whole difference.
   */
  const pendingIsUnsaved =
    pendingHref !== null && !savedLessonSlugs.has(pendingHref.split("/").pop() ?? "");

  const openLesson = useCallback(
    (href: string): "allow" | "held" => {
      if (!dirty) return "allow";
      setPendingHref(href);
      return "held";
    },
    [dirty]
  );

  async function save(): Promise<boolean> {
    if (!course || busy) return false;
    setBusy(true);
    setNote(null);

    const result = await saveCourse(slug, course);
    setBusy(false);

    if (!result.ok) {
      // Kept verbatim: a validation code names the exact place that is wrong.
      setNote(result.detail ?? "Не вдалося зберегти. Спробуйте ще раз.");
      return false;
    }

    history.markClean();
    // Reloaded rather than patched: the server bumps `version` and re-derives
    // readiness, and a screen that kept the old copy would show a blocker list
    // that no longer matches what is stored.
    await load();
    setNote(
      result.data.blockers.length === 0
        ? "Збережено. Блокерів немає."
        : `Збережено. Лишилось блокерів: ${result.data.blockers.length}.`
    );
    return true;
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

  if (!course) {
    return (
      <BuilderShell trail={trail}>
        <BuilderNotice title="Завантажуємо курс…" />
      </BuilderShell>
    );
  }

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
            moduleDrag={moduleDrag}
            lessonDrag={lessonDrag}
            onChange={editCourse}
            onModules={editModules}
            onNote={setNote}
            onOpenLesson={openLesson}
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
        {pendingHref ? (
          <>
            <span className={styles.saveState}>
              {pendingIsUnsaved
                ? "Цього уроку ще немає в базі — його треба зберегти, щоб відкрити."
                : "Є незбережені зміни."}
            </span>
            {/* Offered only for a lesson the server already has. For a freshly
                added one, "go without saving" would DELETE the lesson being
                opened and land on «Урок не знайдено» — the exact dead end this
                whole branch exists to remove. */}
            {pendingIsUnsaved ? null : (
              <button
                className={styles.quietAction}
                type="button"
                onClick={() => {
                  const href = pendingHref;
                  setPendingHref(null);
                  history.markClean();
                  router.push(href);
                }}
                disabled={busy}
              >
                Піти без збереження
              </button>
            )}
            <button
              className={styles.quietAction}
              type="button"
              onClick={() => setPendingHref(null)}
              disabled={busy}
            >
              Лишитись
            </button>
            <button
              className={styles.commitAction}
              type="button"
              onClick={async () => {
                const href = pendingHref;
                const saved = await save();
                if (!saved) return;
                setPendingHref(null);
                router.push(href);
              }}
              disabled={busy}
            >
              {busy ? "Зберігаємо…" : "Зберегти і відкрити"}
            </button>
          </>
        ) : (
          <>
            <BuilderHistory history={history} disabled={busy} />
            <span className={styles.saveState}>{note ?? (dirty ? "Є незбережені зміни" : "Змін немає")}</span>
            <button className={styles.commitAction} type="button" onClick={() => void save()} disabled={busy || !dirty}>
              {busy ? "Зберігаємо…" : "Зберегти"}
            </button>
          </>
        )}
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

/**
 * A dropped lesson, placed in the module it was dropped into.
 *
 * The one refusal is the same one the arrows carry: a module cannot be emptied
 * by a move, because `validateCourse` requires at least one lesson in each and
 * the author would meet that as a save error long after the gesture. Dropping
 * the last lesson of a module elsewhere simply does not take.
 */
function moveLessonTo(course: Course, from: DragRef, to: DragRef, edge: DropEdge): CourseModule[] {
  const modules = course.modules.map((entry) => ({ ...entry, lessons: [...entry.lessons] }));
  const source = modules[from.group];
  const target = modules[to.group];
  if (!source || !target) return modules;
  if (source !== target && source.lessons.length === 1) return modules;

  const insert = landingIndex(from.index, to.index, edge, source === target);
  const [moved] = source.lessons.splice(from.index, 1);
  target.lessons.splice(insert, 0, moved);
  return modules;
}

function ModuleEditor({
  course,
  module,
  moduleIndex,
  moduleDrag,
  lessonDrag,
  onChange,
  onModules,
  onNote,
  onOpenLesson,
}: {
  course: Course;
  module: CourseModule;
  moduleIndex: number;
  moduleDrag: RowDrag;
  lessonDrag: RowDrag;
  onChange: (path: (string | number)[], value: unknown) => void;
  onModules: (next: (course: Course) => CourseModule[]) => void;
  onNote: (note: string | null) => void;
  /** Answers whether the row may follow its own href, or is being held back. */
  onOpenLesson: (href: string) => "allow" | "held";
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

  const moduleRow: DragRef = { list: "module", group: 0, index: moduleIndex };

  return (
    <div className={`${styles.moduleBlock} ${styles.dragRow}`} {...moduleDrag.rowProps(moduleRow)}>
      <div className={styles.moduleHead}>
        <BuilderGrip drag={moduleDrag} row={moduleRow} label={module.title} />
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
              icon: "arrow-up",
              disabled: moduleIndex === 0,
              onSelect: () => onModules((current) => moveItem(current.modules, moduleIndex, moduleIndex - 1)),
            },
            {
              label: "Опустити нижче",
              icon: "arrow-down",
              disabled: moduleIndex === course.modules.length - 1,
              onSelect: () => onModules((current) => moveItem(current.modules, moduleIndex, moduleIndex + 1)),
            },
            {
              label: "Видалити модуль",
              icon: "trash",
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

      {module.lessons.map((lesson, lessonIndex) => {
        const lessonRow: DragRef = { list: "lesson", group: moduleIndex, index: lessonIndex };
        return (
        <div
          className={`${styles.lessonRowWrap} ${styles.dragRow}`}
          key={lesson.id}
          {...lessonDrag.rowProps(lessonRow)}
        >
          <BuilderGrip drag={lessonDrag} row={lessonRow} label={lesson.title} />
          {/* Still a link, not a button: the href is real for every lesson the
              server has, so middle-click and "open in new tab" keep working.
              The click is intercepted only while there is unsaved structure. */}
          <Link
            className={styles.lessonRow}
            href={`/build/${course.slug}/${lesson.slug}`}
            onClick={(event) => {
              if (onOpenLesson(`/build/${course.slug}/${lesson.slug}`) === "held") event.preventDefault();
            }}
          >
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
                icon: "arrow-up",
                disabled: moduleIndex === 0 && lessonIndex === 0,
                onSelect: () => moveLesson(lessonIndex, -1),
              },
              {
                label: "Опустити нижче",
                icon: "arrow-down",
                disabled: moduleIndex === course.modules.length - 1 && lessonIndex === module.lessons.length - 1,
                onSelect: () => moveLesson(lessonIndex, 1),
              },
              { label: "Видалити урок", icon: "trash" as const, danger: true, onSelect: () => deleteLesson(lessonIndex) },
            ]}
          />
        </div>
        );
      })}

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
