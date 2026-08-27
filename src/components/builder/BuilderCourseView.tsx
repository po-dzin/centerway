"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

import { HandGraphic, Icon } from "@/components/Icon";
import {
  newCourseFromTemplate,
  pruneEmptyProse,
  newLesson,
  newModule,
  nextDayIndex,
  PLACEHOLDER_MARKER,
  renumber,
  uniqueSlug,
  type Course,
  type CourseModule,
  type Lesson,
} from "@/lms-core";
import type { LessonDocumentFormat } from "@/lib/lms/lessonDocuments";
import { OFFER_CARD_TITLE_MAX, OFFER_TITLE_MAX, offerCardOverflow } from "@/lib/platform/offerPreview";
import { BuilderFailureNotice, BuilderShell } from "./BuilderShell";
import { BuilderMenu } from "./BuilderMenu";
import { BuilderCourseSettings } from "./BuilderCourseSettings";
import { BuilderBlockers } from "./BuilderBlockers";
import {
  exportLessonFile,
  loadCourse,
  renameCourseSlug,
  saveCourse,
  submitCourseForReview,
  type BuilderCourseDto,
  type BuilderFailure,
} from "./builderClient";
import { BuilderGrip } from "./BuilderGrip";
import { BuilderHistory } from "./BuilderHistory";
import { BuilderEditableTitle } from "./BuilderEditableTitle";
import { BuilderRecordField } from "./BuilderRecordField";
import { useCourseHistory } from "./useCourseHistory";
import { useCourseAutosave } from "./useCourseAutosave";
import { rememberZenPreviewReturn, zenPreviewHref } from "@/components/lms/ZenPreviewShell";
import { useRowDrag, type DragRef, type DropEdge, type RowDrag } from "./useRowDrag";
import {
  LAST_LESSON_REFUSAL,
  moveLessonTo,
  moveModuleTo,
  removeLesson,
  removeModule,
  stepLesson,
  stepModule,
} from "./structureMoves";
import { writePath } from "./blockFields";
import styles from "./Builder.module.css";
import { PlatformLoadingState } from "@/components/platform/PlatformLoadingState";
import { lessonDocumentFailureCopy } from "./lessonDocumentCopy";
import {
  clearDurableCourseDraft,
  inspectDurableCourseDraft,
  type DurableCourseDraft,
} from "./courseDraftStore";
import { BuilderDraftConflict } from "./BuilderDraftConflict";
import { BuilderVersionHistory } from "./BuilderVersionHistory";

type State =
  | { status: "loading" }
  | { status: "failed"; failure: BuilderFailure; detail?: string }
  | { status: "ready"; data: BuilderCourseDto };

const ids = () => crypto.randomUUID();

type StructureView = "rows" | "cards";
type WorkspaceMode = "course" | "content" | "release";
const STRUCTURE_VIEW_KEY = "cw.builder.structureView";
const STRUCTURE_VIEW_EVENT = "cw:builder-structure-view";
const trailTitle = (value: string, fallback: string) =>
  value.includes(PLACEHOLDER_MARKER) || value.trim() === "" ? fallback : value;
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
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>("content");
  const [railCollapsed, setRailCollapsed] = useState(false);
  const [slugEditing, setSlugEditing] = useState(false);
  const [slugDraft, setSlugDraft] = useState("");
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [draftConflict, setDraftConflict] = useState<DurableCourseDraft | null>(null);
  const [versionHistoryOpen, setVersionHistoryOpen] = useState(false);
  const draftGeneration = useRef<number | null>(null);
  const router = useRouter();
  const storedStructureView = useSyncExternalStore(subscribeToStructureView, readStructureView, () => "rows" as StructureView);
  const structureWide = useSyncExternalStore(
    subscribeToStructureWidth,
    () => window.matchMedia(STRUCTURE_WIDE).matches,
    () => false,
  );
  const structureView: StructureView = structureWide ? storedStructureView : "rows";

  const selectWorkspaceMode = (mode: WorkspaceMode) => {
    const hash: Record<WorkspaceMode, string> = {
      course: "#course-overview",
      content: "#course-structure",
      release: "#course-release",
    };
    setWorkspaceMode(mode);
    window.history.replaceState(null, "", hash[mode]);
    window.scrollTo({ top: 0, behavior: "auto" });
  };

  useEffect(() => {
    const syncModeFromHash = () => {
      const next: Record<string, WorkspaceMode> = {
        "#course-overview": "course",
        "#course-structure": "content",
        "#course-release": "release",
      };
      const mode = next[window.location.hash] ?? "content";
      setWorkspaceMode(mode);
    };
    syncModeFromHash();
    window.addEventListener("hashchange", syncModeFromHash);
    return () => window.removeEventListener("hashchange", syncModeFromHash);
  }, []);

  const load = useCallback(async () => {
    const result = await loadCourse(slug);
    if (result.ok) {
      draftGeneration.current = result.data.draftGeneration;
      const durable = await inspectDurableCourseDraft(result.data.course, result.data.draftGeneration);
      setDraftConflict(durable.kind === "conflict" ? durable.draft : null);
      if (durable.kind === "recover") {
        history.recover(result.data.course, durable.draft.course);
        setNote("Відновлено локальні зміни. Вони збережуться автоматично.");
      } else {
        history.reset(result.data.course);
        if (durable.kind === "conflict") {
          setNote("Локальна копія збережена окремо: серверна версія змінилася в іншій вкладці.");
        }
      }
    }
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
      if (result.ok) {
        draftGeneration.current = result.data.draftGeneration;
        const durable = await inspectDurableCourseDraft(result.data.course, result.data.draftGeneration);
        if (cancelled) return;
        setDraftConflict(durable.kind === "conflict" ? durable.draft : null);
        if (durable.kind === "recover") {
          history.recover(result.data.course, durable.draft.course);
          setNote("Відновлено локальні зміни. Вони збережуться автоматично.");
        } else {
          history.reset(result.data.course);
          if (durable.kind === "conflict") {
            setNote("Локальна копія збережена окремо: серверна версія змінилася в іншій вкладці.");
          }
        }
      }
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
        editModules((current) => moveModuleTo(current.modules, from, to, edge));
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
        editModules((current) => moveLessonTo(current.modules, from, to, edge));
      },
      [editModules]
    ),
    { crossGroup: true }
  );

  async function exportLesson(lesson: Lesson, format: LessonDocumentFormat) {
    if (working) return;
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

  const persistCourse = useCallback(async (snapshot: Course) => {
    setNote(null);
    if (draftGeneration.current === null) {
      return { ok: false as const, message: "Курс ще завантажується. Спробуйте за мить." };
    }
    const result = await saveCourse(slug, pruneEmptyProse(snapshot), draftGeneration.current);
    if (!result.ok) {
      if (result.failure === "conflict") {
        return { ok: false as const, message: "Цей курс уже змінили в іншій вкладці. Перезавантажте сторінку, щоб не втратити чужі зміни." };
      }
      return { ok: false as const, message: result.detail ?? "Не вдалося зберегти. Спробуйте ще раз." };
    }
    draftGeneration.current = result.data.draftGeneration;
    // Keep server-derived readiness current without reloading the document. A
    // reload here would overwrite keystrokes made while this request was in
    // flight; the history records the exact accepted snapshot instead.
    setState((current) => current.status === "ready" ? {
      ...current,
      data: {
        ...current.data,
        course: snapshot,
        draftGeneration: result.data.draftGeneration,
        hasPendingRevision: result.data.staged ? true : current.data.hasPendingRevision,
        readiness: { ready: result.data.blockers.length === 0, blockers: result.data.blockers },
        review: result.data.staged || current.data.liveStatus === "draft"
          ? { ...current.data.review, status: "draft", note: null }
          : current.data.review,
      },
    } : current);
    return {
      ok: true as const,
      generation: result.data.draftGeneration,
      message: result.data.blockers.length === 0
        ? "Збережено. Блокерів немає."
        : `Збережено. Лишилось блокерів: ${result.data.blockers.length}.`,
    };
  }, [slug]);

  const autosave = useCourseAutosave({
    course,
    dirty,
    paused: busy,
    persist: persistCourse,
    markSaved: history.markSaved,
    getDraftGeneration: () => draftGeneration.current,
  });
  const working = busy || autosave.saving;
  const save = autosave.saveNow;

  const navigate = useCallback((href: string) => {
    if (!dirty) return router.push(href);
    if (pendingHref) return;
    setPendingHref(href);
    void save().then((saved) => {
      if (saved) router.push(href);
      else setPendingHref(null);
    });
  }, [dirty, pendingHref, router, save]);

  const openLesson = useCallback((href: string): "allow" | "held" => {
    if (!dirty) return "allow";
    navigate(href);
    return "held";
  }, [dirty, navigate]);

  const preview = () => {
    if (working) return;
    const returnTo = `/build/${encodeURIComponent(slug)}`;
    rememberZenPreviewReturn(returnTo);
    navigate(zenPreviewHref(`/learn/${encodeURIComponent(slug)}`, returnTo));
  };

  /**
   * Publishing is a status change and nothing else — it does not save edits.
   *
   * The gate lives in `writeCourseStructure`, so a course with blockers is
   * refused by the server rather than by a disabled button here. The button is
   * disabled anyway, because a control that exists only to be rejected is a
   * worse explanation than a sentence saying what is missing.
   */
  async function setStatus(next: "draft" | "published") {
    if (state.status !== "ready" || working) return;
    setBusy(true);
    setNote(null);

    // The STORED course, not the edited one: publishing an unsaved draft would
    // make the button a second, silent save with a different gate.
    if (draftGeneration.current === null) {
      setBusy(false);
      setNote("Курс ще завантажується. Спробуйте за мить.");
      return;
    }
    const result = await saveCourse(slug, { ...state.data.course, status: next }, draftGeneration.current);
    setBusy(false);

    if (!result.ok) {
      setNote(result.failure === "conflict"
        ? "Цей курс уже змінили в іншій вкладці. Перезавантажте сторінку."
        : result.detail ?? "Не вдалося зберегти. Спробуйте ще раз.");
      return;
    }
    draftGeneration.current = result.data.draftGeneration;

    setNote(next === "published" ? "Опубліковано в базі." : "Переведено в чернетку.");
    await load();
  }

  async function submitReview() {
    if (working || dirty) return;
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
    if (state.status !== "ready" || working || dirty || !state.data.slugEditable) return;
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

  const recoverConflictingDraft = () => {
    if (state.status !== "ready" || !draftConflict) return;
    history.recover(state.data.course, draftConflict.course);
    setDraftConflict(null);
    setNote("Локальну копію відновлено. Вона збережеться як поточна версія.");
  };

  const discardConflictingDraft = () => {
    if (!draftConflict) return;
    void clearDurableCourseDraft(draftConflict.courseId).catch(() => undefined);
    setDraftConflict(null);
    setNote("Залишено актуальну серверну версію.");
  };

  const trail = [{ label: "Курси", href: "/build" }];

  if (state.status === "loading") {
    return (
      <BuilderShell trail={trail}>
        <PlatformLoadingState label="Майстерня" title="Завантажуємо курс…" detail="Відновлюємо структуру, налаштування і статус публікації." />
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
        <PlatformLoadingState label="Майстерня" title="Завантажуємо курс…" detail="Відновлюємо структуру, налаштування і статус публікації." />
      </BuilderShell>
    );
  }

  const { readiness } = state.data;
  // A published course can be edited as a next version. Its `course` is then
  // deliberately a draft while learners keep the stable live release.
  const published = state.data.liveStatus === "published";
  /* How far past a card's line this title runs. Zero for every course on the
     shelf today; the warning below only appears once one is written long. */
  const titleOverflow = offerCardOverflow(course.title);
  const lessonCount = course.modules.reduce((total, module) => total + module.lessons.length, 0);

  return (
    <BuilderShell
      trail={[{ label: "Курси", onNavigate: () => navigate("/build") }, { label: trailTitle(course.title, "Курс без назви") }]}
      tools={
        <>
          <button
            className={styles.menuTrigger}
            type="button"
            aria-label="Історія версій"
            title="Історія версій"
            /* `.menuTrigger[aria-expanded="true"]` already carries the hover
               background — this was the one caller that never set the
               attribute, so the trigger gave no sign the drawer it opens is
               open: it looked pressed for as long as the pointer sat on it and
               forgot the moment it moved away. */
            aria-expanded={versionHistoryOpen}
            onClick={() => setVersionHistoryOpen(true)}
          >
            <Icon name="clock" size={18} />
          </button>
          <button
            className={styles.workspacePreviewAction}
            type="button"
            onClick={preview}
            disabled={working}
            aria-label="Переглянути як учень"
            title={dirty ? "Зберегти й відкрити як учень" : "Відкрити як учень"}
          >
            <Icon name="eye" size={18} />
            <span className={styles.workspaceActionLabel}>Переглянути</span>
          </button>
          <button
            className={`${styles.commitAction} ${styles.courseHeaderSave}`}
            type="button"
            onClick={() => void save()}
            disabled={working || !dirty}
          >
            {autosave.saving ? "Зберігаємо…" : "Зберегти зараз"}
          </button>
        </>
      }
      aside={
        <BuilderCourseRail
          published={published}
          blockerCount={readiness.blockers.length}
          activeMode={workspaceMode}
          onMode={selectWorkspaceMode}
        />
      }
      /* COMPACT, NOT COLLAPSED. Folding this rail must leave the three modes on
         screen as icons — they are the whole navigation of the course
         workspace, and a fold that removes them is a fold that removes the way
         out. `collapsed` empties the panel; `compact` narrows it. */
      asideCompact={railCollapsed}
      onAsideToggle={() => setRailCollapsed((current) => !current)}
      onNavigate={navigate}
    >
      <BuilderVersionHistory
        slug={slug}
        open={versionHistoryOpen}
        checkpointDisabled={working || dirty}
        onClose={() => setVersionHistoryOpen(false)}
      />
      {draftConflict ? (
        <BuilderDraftConflict onRecover={recoverConflictingDraft} onDiscard={discardConflictingDraft} />
      ) : null}
      <nav className={styles.courseMobileNav} aria-label="Розділи курсу">
        <a className={styles.courseMobileNavItem} href="#course-overview" aria-current={workspaceMode === "course" ? "page" : undefined} onClick={(event) => { event.preventDefault(); selectWorkspaceMode("course"); }}><BuilderInkLabel>Огляд</BuilderInkLabel></a>
        <a className={styles.courseMobileNavItem} href="#course-structure" aria-current={workspaceMode === "content" ? "page" : undefined} onClick={(event) => { event.preventDefault(); selectWorkspaceMode("content"); }}><BuilderInkLabel>Зміст</BuilderInkLabel></a>
        <a className={styles.courseMobileNavItem} href="#course-release" aria-current={workspaceMode === "release" ? "page" : undefined} onClick={(event) => { event.preventDefault(); selectWorkspaceMode("release"); }}><BuilderInkLabel>Публікація</BuilderInkLabel></a>
      </nav>

      <section className={styles.courseWorkspacePanel} id="course-overview" hidden={workspaceMode !== "course"} aria-labelledby="course-overview-title">
      <div className={styles.docHead}>
        <div className={styles.courseTitleRow}>
          <BuilderEditableTitle
            register="record"
            value={course.title}
            label="Редагувати назву курсу"
            maxLength={OFFER_TITLE_MAX}
            onChange={(value) => editCourse(["title"], value)}
          />
          <span className={published ? styles.pillPublished : styles.pill}>
            {published ? "Опубліковано" : "Чернетка"}
          </span>
        </div>
        {/* TWO LIMITS, AND THEY ARE DIFFERENT KINDS OF LIMIT. The page cannot
            clip, so its ceiling is hard and the field above simply stops at
            OFFER_TITLE_MAX. A card CAN clip, so its ceiling is a warning: the
            name is the author's, some names really are long, and an ellipsis on
            a card is a smaller cost than a title they were not allowed to
            write. What they may not have is the ellipsis as a surprise. */}
        {titleOverflow > 0 ? (
          <p className={styles.courseTitleHint}>
            На картці в каталозі вміщається {OFFER_CARD_TITLE_MAX}{" "}
            {plural(OFFER_CARD_TITLE_MAX, "символ", "символи", "символів")} — у назві на {titleOverflow}{" "}
            {plural(titleOverflow, "символ", "символи", "символів")} більше. Там її буде обрізано.
          </p>
        ) : null}
        <div className={styles.pageLead}>
          <BuilderRecordField
            multiline
            value={course.summary}
            label="Редагувати короткий опис курсу"
            placeholder="Про що цей курс — одне-два речення."
            onChange={(next) => editCourse(["summary"], next)}
          />
        </div>
        <div className={styles.courseAddressRow}>
          <span className={styles.courseAddressLabel}>Адреса курсу</span>
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
                aria-label="Частина адреси курсу після домену"
                onChange={(event) => setSlugDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") setSlugEditing(false);
                }}
              />
              <button className={styles.quietAction} type="button" onClick={() => setSlugEditing(false)} disabled={working}>Скасувати</button>
              <button className={styles.quietAction} type="submit" disabled={working || slugDraft.trim() === ""}>Зберегти</button>
            </form>
          ) : (
            <>
              <code className={styles.courseAddressValue}>my.centerway.net.ua/{course.slug}</code>
              {state.data.slugEditable ? (
                <span className={styles.slugControlTooltip} title={dirty ? "Спочатку збережіть зміни курсу" : "Змінити автоматично створену адресу"}>
                  <button
                    className={styles.slugEditAction}
                    type="button"
                    aria-label={dirty ? "Спочатку збережіть зміни курсу" : "Змінити автоматично створену адресу"}
                    aria-describedby="course-address-hint"
                    disabled={dirty || busy}
                    onClick={() => {
                      setSlugDraft(course.slug);
                      setSlugEditing(true);
                    }}
                  >
                    <Icon name="edit" size={16} />
                    <HandGraphic className={styles.iconInkRing} name="ink-ring" size={42} />
                  </button>
                </span>
              ) : (
                <span
                  className={styles.slugLockState}
                  role="img"
                  aria-label="Адресу закріплено"
                  title="Адресу закріплено після першої публікації, появи учнів або підключення вітрини"
                >
                  <Icon name="lock" size={16} />
                </span>
              )}
              <span className={styles.courseAddressHint} id="course-address-hint">
                {state.data.slugEditable
                  ? "Адресу створено автоматично. Її можна змінити до першої публікації, появи учнів або підключення вітрини."
                  : "Адресу закріплено, щоб уже видані посилання залишалися робочими."}
              </span>
            </>
          )}
        </div>
      </div>

      <div className={styles.courseSettingsPanel}>
        {/* «Про курс», not «Огляд». This heading names the settings panel it
            sits on, and the tab above already says «Огляд» — one word printed
            twice in two rows is not a second fact. */}
        <h2 className={styles.panelTitle} id="course-overview-title">Про курс</h2>
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
      </div>
      </section>

      <section id="course-structure" hidden={workspaceMode !== "content"} className={`${styles.panel} ${styles.structure} ${structureView === "cards" ? styles.structureCards : ""}`} aria-labelledby="course-structure-title">
        <header className={`${styles.panelHead} ${styles.structureHead}`}>
          <div>
            {/* No kicker. It printed the course title one row under the trail
                that already names it — on a phone that echo cost a whole line
                of a screen where the first module was six rows down. */}
            <h2 className={styles.structureTitle} id="course-structure-title">Зміст</h2>
            <p className={styles.structureMeta}>
              {course.modules.length} {plural(course.modules.length, "модуль", "модулі", "модулів")} ·{" "}
              {lessonCount} {plural(lessonCount, "урок", "уроки", "уроків")}
            </p>
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
        </header>

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
              busy={working}
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

      <section className={styles.releaseWorkspace} id="course-release" hidden={workspaceMode !== "release"} aria-labelledby="course-release-title">
        <header className={styles.releaseWorkspaceHead}>
          <div>
            <span className={styles.courseMeta}>Публікація курсу</span>
            <h2 className={styles.pageTitle} id="course-release-title">Перевірка й публікація</h2>
          </div>
          <div className={styles.releaseSummary}>
            <span className={published ? styles.pillPublished : styles.pill}>{published ? "Опубліковано" : "Чернетка"}</span>
            <span className={styles.panelStatus}>{reviewStatusLabel(state.data)}</span>
          </div>
        </header>
        {note ? <p className={styles.noticeLine} aria-live="polite">{note}</p> : null}
        <BuilderBlockers blockers={readiness.blockers} />
        <section className={styles.releaseSection}>
          <h3 className={styles.panelTitle}>Дія публікації</h3>
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
                  <button className={styles.commitAction} type="button" onClick={() => void submitReview()} disabled={working || dirty || !readiness.ready}>Надіслати оновлення на перевірку</button>
                )
              ) : (
                <button className={styles.retreatAction} type="button" onClick={() => setStatus("draft")} disabled={working}>Зняти з публікації</button>
              )
            ) : !state.data.review.enabled || state.data.review.status === "approved" ? (
              <button className={styles.commitAction} type="button" onClick={() => setStatus("published")} disabled={working || dirty || !readiness.ready}>Опублікувати</button>
            ) : state.data.review.status === "in_review" ? null : (
              <button className={styles.commitAction} type="button" onClick={() => void submitReview()} disabled={working || dirty || !readiness.ready}>Надіслати на перевірку</button>
            )}
          </div>
        </section>
      </section>

      {/* ONE BAR, ONE SIZE, IN EVERY STATE.

          It used to render two different things: three controls normally, and a
          single sentence while a save-before-navigate was in flight. So the one
          element that sits at the bottom edge of the document changed its own
          height and its own column layout at the exact moment the author was
          waiting on it — the thing you are looking at moved while you looked.

          The slots are now fixed and only their CONTENT changes. Undo and save
          are disabled rather than removed while a departure is pending, which
          is also the truth: they are unavailable, not absent. */}
      <div className={`${styles.saveBar} ${styles.courseSaveBar}`} data-pending={pendingHref ? "" : undefined}>
        <BuilderHistory history={history} disabled={working || pendingHref !== null} />
        <span className={styles.saveState} role="status" aria-live="polite">
          {pendingHref
            ? "Зберігаємо зміни перед переходом…"
            : note ?? autosave.message ?? (dirty ? "Зміни збережуться автоматично" : "Усі зміни збережено")}
        </span>
        {/* The label never changes. It names what the button DOES, and the line
            beside it already says what is happening — a button that relabels
            itself mid-press is just a narrower button arriving under the
            cursor. Progress is carried by `disabled` and by the status. */}
        <button
          className={styles.commitAction}
          type="button"
          onClick={() => void save()}
          disabled={working || pendingHref !== null || !dirty}
        >
          Зберегти зараз
        </button>
      </div>
    </BuilderShell>
  );
}

function BuilderCourseRail({
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
        <a className={styles.courseRailLink} href="#course-overview" aria-label="Огляд" aria-current={activeMode === "course" ? "page" : undefined} onClick={(event) => { event.preventDefault(); onMode("course"); }}>
          <span className={styles.courseRailIcon}><Icon name="guide" size={20} /><HandGraphic className={styles.iconInkRing} name="ink-ring" size={42} /></span>
          <BuilderInkLabel>Огляд</BuilderInkLabel>
        </a>
        <a className={styles.courseRailLink} href="#course-structure" aria-label="Зміст" aria-current={activeMode === "content" ? "page" : undefined} onClick={(event) => { event.preventDefault(); onMode("content"); }}>
          <span className={styles.courseRailIcon}><Icon name="view-rows" size={20} /><HandGraphic className={styles.iconInkRing} name="ink-ring" size={42} /></span>
          <BuilderInkLabel>Зміст</BuilderInkLabel>
        </a>
        <a className={styles.courseRailLink} href="#course-release" aria-label="Публікація" aria-current={activeMode === "release" ? "page" : undefined} onClick={(event) => { event.preventDefault(); onMode("release"); }}>
          <span className={styles.courseRailIcon}><Icon name="shield-check" size={20} /><HandGraphic className={styles.iconInkRing} name="ink-ring" size={42} /></span>
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
  onExportLesson: (lesson: Lesson, format: LessonDocumentFormat) => Promise<void>;
}) {
  const isOnlyModule = course.modules.length === 1;
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
