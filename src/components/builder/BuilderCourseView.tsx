"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

import { HandGraphic, Icon } from "@/components/Icon";
import {
  moveItem,
  newCourseFromTemplate,
  pruneEmptyProse,
  newLesson,
  newModule,
  nextDayIndex,
  renumber,
  uniqueSlug,
  type Course,
  type CourseModule,
  type Lesson,
} from "@/lms-core";
import type { LessonDocumentFormat } from "@/lib/lms/lessonDocuments";
import { BuilderFailureNotice, BuilderShell } from "./BuilderShell";
import { BuilderMenu } from "./BuilderMenu";
import { BuilderSheet } from "./BuilderSheet";
import { BuilderCourseSettings } from "./BuilderCourseSettings";
import { BuilderBlockers } from "./BuilderBlockers";
import {
  exportLessonFile,
  importLessonFiles,
  loadCourse,
  renameCourseSlug,
  saveCourse,
  submitCourseForReview,
  type BuilderCourseDto,
  type BuilderFailure,
} from "./builderClient";
import { BuilderGrip } from "./BuilderGrip";
import { BuilderInlineEditor } from "./BuilderInlineEditor";
import { BuilderHistory } from "./BuilderHistory";
import { BuilderEditableTitle } from "./BuilderEditableTitle";
import { useCourseHistory } from "./useCourseHistory";
import { landingIndex, useRowDrag, type DragRef, type DropEdge, type RowDrag } from "./useRowDrag";
import { writePath } from "./blockFields";
import styles from "./Builder.module.css";
import { PlatformLoadingState } from "@/components/platform/PlatformLoadingState";

type State =
  | { status: "loading" }
  | { status: "failed"; failure: BuilderFailure; detail?: string }
  | { status: "ready"; data: BuilderCourseDto };

const ids = () => crypto.randomUUID();

type StructureView = "rows" | "cards";
const STRUCTURE_VIEW_KEY = "cw.builder.structureView";
const STRUCTURE_VIEW_EVENT = "cw:builder-structure-view";
// Two module cards need enough measure for a title, grip and overflow menu.
// Phones and compact tablets stay in the faster, reorderable row view.
const STRUCTURE_WIDE = "(min-width: 901px)";

function subscribeToStructureView(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(STRUCTURE_VIEW_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(STRUCTURE_VIEW_EVENT, onChange);
  };
}

function readStructureView(): StructureView {
  return window.localStorage.getItem(STRUCTURE_VIEW_KEY) === "cards" ? "cards" : "rows";
}

function subscribeToStructureWidth(onChange: () => void) {
  const query = window.matchMedia(STRUCTURE_WIDE);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

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
  const [releaseOpen, setReleaseOpen] = useState(false);
  const [workspaceMode, setWorkspaceMode] = useState<"course" | "content">("content");
  const [slugEditing, setSlugEditing] = useState(false);
  const [slugDraft, setSlugDraft] = useState("");
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const router = useRouter();
  const storedStructureView = useSyncExternalStore(subscribeToStructureView, readStructureView, () => "rows" as StructureView);
  const structureWide = useSyncExternalStore(
    subscribeToStructureWidth,
    () => window.matchMedia(STRUCTURE_WIDE).matches,
    () => false,
  );
  const structureView: StructureView = structureWide ? storedStructureView : "rows";

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

  async function importLessons(moduleIndex: number, files: File[]) {
    if (!files.length || busy) return;
    setBusy(true);
    setNote(null);
    const result = await importLessonFiles(slug, files);
    setBusy(false);
    if (!result.ok) {
      setNote(lessonDocumentFailureCopy(result.detail, "Не вдалося прочитати файли уроків."));
      return;
    }

    history.edit(null, (current) => {
      const taken = current.modules.flatMap((entry) => entry.lessons.map((lesson) => lesson.slug));
      let dayIndex = nextDayIndex(current);
      return {
        ...current,
        modules: renumber(current.modules.map((entry, index) => {
          if (index !== moduleIndex) return entry;
          const imported = result.data.lessons.map((lesson, importedIndex) => {
            const lessonSlug = uniqueSlug(lesson.title, taken);
            taken.push(lessonSlug);
            const nextLesson: Lesson = {
              ...lesson,
              slug: lessonSlug,
              order: entry.lessons.length + importedIndex + 1,
              dayIndex: entry.reference ? undefined : dayIndex,
            };
            if (!entry.reference && dayIndex !== undefined) dayIndex += 1;
            return nextLesson;
          });
          return { ...entry, lessons: [...entry.lessons, ...imported] };
        })),
      };
    });
    setNote(
      `${result.data.lessons.length} ${plural(result.data.lessons.length, "урок додано", "уроки додано", "уроків додано")}. Перевірте структуру й збережіть курс.`,
    );
  }

  async function exportLesson(lesson: Lesson, format: LessonDocumentFormat) {
    if (busy) return;
    setBusy(true);
    setNote(null);
    const result = await exportLessonFile(slug, lesson, format);
    setBusy(false);
    if (!result.ok) {
      setNote(lessonDocumentFailureCopy(result.detail, "Не вдалося експортувати урок."));
      return;
    }

    const url = URL.createObjectURL(result.data.blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = result.data.filename;
    link.click();
    URL.revokeObjectURL(url);
    setNote(`Експортовано ${result.data.filename}`);
  }

  async function save(): Promise<boolean> {
    if (!course || busy) return false;
    setBusy(true);
    setNote(null);

    const result = await saveCourse(slug, pruneEmptyProse(course));
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

  async function submitReview() {
    if (busy || dirty) return;
    setBusy(true);
    setNote(null);
    const result = await submitCourseForReview(slug);
    setBusy(false);
    if (!result.ok) {
      setNote(result.detail ?? "Не вдалося надіслати курс на перевірку.");
      return;
    }
    setNote("Курс надіслано адміністратору на перевірку.");
    await load();
  }

  async function renameSlug() {
    if (state.status !== "ready" || busy || dirty || !state.data.slugEditable) return;
    setBusy(true);
    setNote(null);
    const result = await renameCourseSlug(slug, slugDraft);
    setBusy(false);
    if (!result.ok) {
      const copy: Record<string, string> = {
        lms_builder_missing_slug: "Введіть адресу курсу.",
        lms_builder_slug_conflict: "Ця адреса вже зайнята. Спробуйте іншу.",
        lms_builder_slug_locked: "Адресу вже закріплено: курс випущено, показано у вітрині або в ньому є учні.",
      };
      setNote((result.detail && copy[result.detail]) || "Не вдалося змінити адресу курсу.");
      return;
    }
    setSlugEditing(false);
    setNote("Адресу курсу змінено.");
    router.replace(`/build/${result.data.slug}`);
  }

  const chooseStructureView = (next: StructureView) => {
    window.localStorage.setItem(STRUCTURE_VIEW_KEY, next);
    window.dispatchEvent(new Event(STRUCTURE_VIEW_EVENT));
  };

  const trail = [{ label: "Курси", href: "/build" }];

  if (state.status === "loading") {
    return (
      <BuilderShell trail={trail}>
        <PlatformLoadingState label="Білдер" title="Завантажуємо курс…" detail="Відновлюємо структуру, налаштування і статус публікації." />
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
        <PlatformLoadingState label="Білдер" title="Завантажуємо курс…" detail="Відновлюємо структуру, налаштування і статус публікації." />
      </BuilderShell>
    );
  }

  const { readiness } = state.data;
  // A published course can be edited as a next version. Its `course` is then
  // deliberately a draft while learners keep the stable live release.
  const published = state.data.liveStatus === "published";
  const lessonCount = course.modules.reduce((total, module) => total + module.lessons.length, 0);

  return (
    <BuilderShell
      trail={[...trail, { label: course.slug }]}
      aside={
        <BuilderCourseRail
          published={published}
          blockerCount={readiness.blockers.length}
          activeMode={releaseOpen ? "release" : workspaceMode}
          onMode={setWorkspaceMode}
          onRelease={() => {
            setSettingsOpen(false);
            setReleaseOpen(true);
          }}
        />
      }
      tools={
        <button
          className={styles.menuTrigger}
          type="button"
          aria-label="Налаштування курсу"
          aria-expanded={settingsOpen}
          onClick={() => {
            setReleaseOpen(false);
            setSettingsOpen(true);
          }}
        >
          <Icon name="settings" size={18} />
          <HandGraphic className={styles.iconInkRing} name="ink-ring" size={42} />
        </button>
      }
    >
      {/* Settings live behind the gear, not in the page. They are entered
          deliberately and changed rarely; in the flow they cost every visit a
          scroll past the entitlement codes to reach the lesson list. */}
      <BuilderSheet open={settingsOpen} title="Налаштування курсу" onClose={() => setSettingsOpen(false)}>
        <BuilderCourseSettings
          course={course}
          onChange={editCourse}
          onApplyTemplate={(template) => {
            history.edit(null, (current) => {
              const preset = newCourseFromTemplate(ids, {
                slug: current.slug,
                title: current.title,
                programSlug: current.programSlug,
                template,
              });
              return { ...current, schedule: preset.schedule, modules: preset.modules };
            });
            setNote("Стартову структуру застосовано. Перевірте модулі й збережіть курс.");
          }}
        />
      </BuilderSheet>

      <BuilderSheet open={releaseOpen} title="Випуск" placement="side" onClose={() => setReleaseOpen(false)}>
        <div className={styles.releaseSheetContent}>
          <div className={styles.releaseSummary}>
            <span className={published ? styles.pillPublished : styles.pill}>
              {published ? "Опубліковано" : "Чернетка"}
            </span>
            <span className={styles.panelStatus}>{reviewStatusLabel(state.data)}</span>
          </div>
          <BuilderBlockers blockers={readiness.blockers} />
          <section className={styles.releaseSection}>
            <h3 className={styles.panelTitle}>Перевірка й публікація</h3>
            <p className={styles.panelText}>
              {state.data.hasPendingRevision
                ? "Ви редагуєте наступну версію. Учні поки бачать опублікований курс; надішліть оновлення на перевірку, коли воно готове."
                : state.data.review.enabled
                ? "Збережіть готову структуру й надішліть її на перевірку. Після схвалення курс можна відкрити учням; видимість у каталозі окремо визначає адміністратор."
                : "Контур модерації ще не активовано в базі. Поточне ручне тестування публікації залишається доступним."}
            </p>
            {state.data.review.note ? <p className={styles.panelText}>Коментар адміністратора: {state.data.review.note}</p> : null}
            {dirty ? <p className={styles.panelText}>Спочатку збережіть поточні зміни структури.</p> : null}
            <div className={styles.panelActions}>
              {published ? (
                state.data.hasPendingRevision ? (
                  state.data.review.status === "in_review" ? null : (
                    <button className={styles.commitAction} type="button" onClick={() => void submitReview()} disabled={busy || dirty || !readiness.ready}>
                      Надіслати оновлення на перевірку
                    </button>
                  )
                ) : (
                  <button className={styles.retreatAction} type="button" onClick={() => setStatus("draft")} disabled={busy}>
                    Зняти з публікації
                  </button>
                )
              ) : !state.data.review.enabled || state.data.review.status === "approved" ? (
                <button className={styles.commitAction} type="button" onClick={() => setStatus("published")} disabled={busy || !readiness.ready}>
                  Опублікувати
                </button>
              ) : state.data.review.status === "in_review" ? null : (
                <button className={styles.commitAction} type="button" onClick={() => void submitReview()} disabled={busy || dirty || !readiness.ready}>
                  Надіслати на перевірку
                </button>
              )}
            </div>
          </section>
        </div>
      </BuilderSheet>

      <nav className={styles.courseMobileNav} aria-label="Розділи курсу">
        <a className={styles.courseMobileNavItem} href="#course-overview" aria-current={!releaseOpen && workspaceMode === "course" ? "page" : undefined} onClick={() => setWorkspaceMode("course")}><BuilderInkLabel>Курс</BuilderInkLabel></a>
        <a className={styles.courseMobileNavItem} href="#course-structure" aria-current={!releaseOpen && workspaceMode === "content" ? "page" : undefined} onClick={() => setWorkspaceMode("content")}><BuilderInkLabel>Зміст</BuilderInkLabel></a>
        <button className={styles.courseMobileNavItem} type="button" aria-current={releaseOpen ? "page" : undefined} onClick={() => setReleaseOpen(true)}><BuilderInkLabel>Випуск</BuilderInkLabel></button>
      </nav>

      {/* Edited where it is read — see the lesson editor. The gear keeps what
          has no place in a document: address, schedule, codes, palette. */}
      <div className={styles.docHead} id="course-overview">
        <div className={styles.courseTitleRow}>
          <BuilderEditableTitle
            value={course.title}
            label="Редагувати назву курсу"
            onChange={(value) => editCourse(["title"], value)}
          />
          <span className={published ? styles.pillPublished : styles.pill}>
            {published ? "Опубліковано" : "Чернетка"}
          </span>
        </div>
        <div className={styles.pageLead}>
          <BuilderInlineEditor
            bare
            multiline
            value={course.summary}
            label="Короткий опис курсу"
            placeholder="Про що цей курс — одне-два речення."
            onChange={(next) => editCourse(["summary"], next)}
          />
        </div>
        <div className={styles.courseAddressRow}>
          <span className={styles.courseAddressLabel}>Адреса</span>
          {slugEditing ? (
            <form
              className={styles.slugForm}
              onSubmit={(event) => {
                event.preventDefault();
                void renameSlug();
              }}
            >
              <input
                className={styles.slugInput}
                value={slugDraft}
                autoFocus
                aria-label="Адреса курсу"
                onChange={(event) => setSlugDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") setSlugEditing(false);
                }}
              />
              <button className={styles.quietAction} type="button" onClick={() => setSlugEditing(false)} disabled={busy}>Скасувати</button>
              <button className={styles.quietAction} type="submit" disabled={busy || slugDraft.trim() === ""}>Зберегти</button>
            </form>
          ) : (
            <>
              <code className={styles.courseAddressValue}>{course.slug}</code>
              {state.data.slugEditable ? (
                <button
                  className={styles.slugEditAction}
                  type="button"
                  aria-label="Редагувати адресу курсу"
                  title={dirty ? "Спочатку збережіть зміни" : "Редагувати адресу курсу"}
                  disabled={dirty || busy}
                  onClick={() => {
                    setSlugDraft(course.slug);
                    setSlugEditing(true);
                  }}
                >
                  <Icon name="edit" size={16} />
                </button>
              ) : null}
              <span className={styles.courseAddressHint}>
                {state.data.slugEditable ? "Можна змінити, поки це невикористана чернетка" : "Адресу закріплено"}
              </span>
            </>
          )}
        </div>
      </div>

      <section id="course-structure" className={`${styles.panel} ${styles.structure} ${structureView === "cards" ? styles.structureCards : ""}`}>
        <div className={styles.panelHead}>
          <div>
            <h2 className={styles.panelTitle}>Структура курсу</h2>
            <span className={styles.courseMeta}>
              {course.modules.length} {plural(course.modules.length, "модуль", "модулі", "модулів")} ·{" "}
              {lessonCount} {plural(lessonCount, "урок", "уроки", "уроків")}
            </span>
          </div>
          {structureWide ? (
            <div className={styles.viewSwitch} role="group" aria-label="Вигляд структури">
              <button className={styles.viewOption} type="button" aria-label="Ряди" aria-pressed={structureView === "rows"} onClick={() => chooseStructureView("rows")}>
                <Icon name="view-rows" size={18} />
                <HandGraphic className={styles.iconInkRing} name="ink-ring" size={42} />
              </button>
              <button className={styles.viewOption} type="button" aria-label="Картки" aria-pressed={structureView === "cards"} onClick={() => chooseStructureView("cards")}>
                <Icon name="view-cards" size={18} />
                <HandGraphic className={styles.iconInkRing} name="ink-ring" size={42} />
              </button>
            </div>
          ) : null}
        </div>

        <div className={styles.structureModules}>
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
              busy={busy}
              onImportLessons={(files) => importLessons(moduleIndex, files)}
              onExportLesson={exportLesson}
            />
          ))}
        </div>

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

      <section className={styles.courseStatusStrip} aria-label="Стан курсу й випуск">
        <span className={styles.courseStatusItem}>
          <strong>{published ? "Опубліковано" : "Чернетка"}</strong>
          <span>{published ? "Курс відкритий учням" : "Робоча версія курсу"}</span>
        </span>
        <button className={styles.courseStatusItemButton} type="button" onClick={() => setReleaseOpen(true)}>
          <strong>{readiness.blockers.length} {plural(readiness.blockers.length, "блокер", "блокери", "блокерів")}</strong>
          <span>{readiness.ready ? "Готово до перевірки" : "Потребують уваги"}</span>
        </button>
        <button className={styles.courseStatusItemButton} type="button" onClick={() => setReleaseOpen(true)}>
          <strong>{reviewStatusLabel(state.data)}</strong>
          <span>Відкрити стан випуску</span>
        </button>
        <button
          className={styles.releaseAction}
          type="button"
          aria-expanded={releaseOpen}
          onClick={() => {
            setSettingsOpen(false);
            setReleaseOpen(true);
          }}
        >
          Випуск
        </button>
      </section>

      <div className={`${styles.saveBar} ${styles.courseSaveBar}`} data-pending={pendingHref ? "" : undefined}>
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
            <span className={styles.saveState}>{note ?? (dirty ? "Не збережено" : "Збережено")}</span>
            <button className={styles.commitAction} type="button" onClick={() => void save()} disabled={busy || !dirty}>
              {busy ? "Зберігаємо…" : "Зберегти зміни"}
            </button>
          </>
        )}
      </div>
    </BuilderShell>
  );
}

function BuilderCourseRail({
  published,
  blockerCount,
  activeMode,
  onMode,
  onRelease,
}: {
  published: boolean;
  blockerCount: number;
  activeMode: "course" | "content" | "release";
  onMode: (mode: "course" | "content") => void;
  onRelease: () => void;
}) {
  return (
    <div className={styles.courseRail}>
      <nav className={styles.courseRailNav} aria-label="Розділи курсу">
        <a className={styles.courseRailLink} href="#course-overview" aria-current={activeMode === "course" ? "page" : undefined} onClick={() => onMode("course")}>
          <Icon name="guide" size={20} />
          <BuilderInkLabel>Курс</BuilderInkLabel>
        </a>
        <a className={styles.courseRailLink} href="#course-structure" aria-current={activeMode === "content" ? "page" : undefined} onClick={() => onMode("content")}>
          <Icon name="view-rows" size={20} />
          <BuilderInkLabel>Зміст</BuilderInkLabel>
        </a>
        <button className={styles.courseRailLink} type="button" aria-current={activeMode === "release" ? "page" : undefined} onClick={onRelease}>
          <Icon name="motion" size={20} />
          <BuilderInkLabel>Випуск</BuilderInkLabel>
        </button>
      </nav>
      <div className={styles.courseRailStatus}>
        <span className={styles.courseRailStatusLine}>
          <HandGraphic className={styles.courseRailStatusDot} name="dot" size={12} />
          {published ? "Опубліковано" : "Чернетка"}
        </span>
        <button className={styles.courseRailStatusLine} type="button" onClick={onRelease}>
          <HandGraphic className={styles.courseRailStatusDotBoundary} name="dot" size={12} />
          {blockerCount} {plural(blockerCount, "блокер", "блокери", "блокерів")}
        </button>
      </div>
    </div>
  );
}

function BuilderInkLabel({ children }: { children: string }) {
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
  onNote: (note: string | null) => void;
  /** Answers whether the row may follow its own href, or is being held back. */
  onOpenLesson: (href: string) => "allow" | "held";
  busy: boolean;
  onImportLessons: (files: File[]) => Promise<void>;
  onExportLesson: (lesson: Lesson, format: LessonDocumentFormat) => Promise<void>;
}) {
  const isOnlyModule = course.modules.length === 1;
  const importPicker = useRef<HTMLInputElement>(null);
  const [collapsed, setCollapsed] = useState(false);

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
    <div
      className={`${styles.moduleBlock} ${styles.dragRow}`}
      /* The rail reads this: a reference module is outside the sequence, so it
         gets a dash on the path instead of the next number, and the numbers
         after it do not skip. */
      data-reference={module.reference === true ? "" : undefined}
      {...moduleDrag.rowProps(moduleRow)}
    >
      <div className={styles.moduleHead}>
        <BuilderGrip drag={moduleDrag} row={moduleRow} label={module.title} />
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
              onSelect: () => onModules((current) => moveItem(current.modules, moduleIndex, moduleIndex - 1)),
            },
            {
              label: "Опустити нижче",
              icon: "arrow-down",
              disabled: moduleIndex === course.modules.length - 1,
              onSelect: () => onModules((current) => moveItem(current.modules, moduleIndex, moduleIndex + 1)),
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
              onSelect: () => onModules((current) => current.modules.filter((_, index) => index !== moduleIndex)),
            },
          ]}
        />
      </div>

      {collapsed ? null : <>
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
          {/* Still a link, not a button: the href is real for every lesson the
              server has, so middle-click and "open in new tab" keep working.
              The click is intercepted only while there is unsaved structure. */}
          <Link
            className={styles.lessonRow}
            href={`/build/${course.slug}/${lesson.slug}`}
            title={lesson.title}
            onClick={(event) => {
              if (onOpenLesson(`/build/${course.slug}/${lesson.slug}`) === "held") event.preventDefault();
            }}
          >
            <Icon className={styles.lessonIcon} name="document" size={20} />
            <span className={styles.lessonText}>
              <span className={styles.lessonName}>{lesson.title}</span>
              <span className={styles.lessonMeta}>
                {lesson.dayIndex ? `День ${lesson.dayIndex} · ` : ""}
                {lesson.blocks.length} {plural(lesson.blocks.length, "блок", "блоки", "блоків")}
              </span>
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
              { label: "Експортувати Markdown", disabled: busy, onSelect: () => void onExportLesson(lesson, "md") },
              { label: "Експортувати Word", disabled: busy, onSelect: () => void onExportLesson(lesson, "docx") },
              { label: "Експортувати текст", disabled: busy, onSelect: () => void onExportLesson(lesson, "txt") },
              { label: "Видалити урок", icon: "trash" as const, danger: true, onSelect: () => deleteLesson(lessonIndex) },
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
              })
            )
          }
        >
          <Icon name="plus" size={20} /> Новий урок
        </button>
        <button className={styles.quietAction} type="button" disabled={busy} onClick={() => importPicker.current?.click()}>
          <Icon name="import" size={20} /> {busy ? "Опрацьовуємо…" : "Імпорт"}
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
            event.target.value = "";
            if (files.length) void onImportLessons(files);
          }}
        />
      </div>
      </>}
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

function reviewStatusLabel(data: BuilderCourseDto): string {
  if (data.course.status === "published") return "Курс відкритий учням";
  if (!data.review.enabled) return "Ручний тестовий контур";
  if (data.review.status === "approved") return "Перевірку пройдено";
  if (data.review.status === "in_review") return "На перевірці";
  if (data.review.status === "changes_requested") return "Потрібні зміни";
  return "Перевірка не розпочата";
}

function lessonDocumentFailureCopy(detail: string | undefined, fallback: string): string {
  const messages: Record<string, string> = {
    lms_lesson_document_unsupported_format: "Підтримуються лише Markdown (.md), Word (.docx) і текст (.txt).",
    lms_lesson_document_too_large: "Один із файлів завеликий. Максимум — 5 МБ на урок.",
    lms_lesson_document_too_many_files: "За один раз можна додати не більше 20 уроків.",
    lms_lesson_document_empty: "У документі немає тексту, який можна перетворити на урок.",
    lms_lesson_document_invalid_docx: "Word-файл пошкоджений або має неочікувану структуру.",
    lms_lesson_document_invalid_utf8: "Текстовий файл має бути збережений у UTF-8.",
  };
  return (detail && messages[detail]) || fallback;
}
