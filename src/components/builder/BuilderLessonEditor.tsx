"use client";

import { useRouter } from "next/navigation";
import { Fragment, useCallback, useEffect, useRef, useState, type DragEvent } from "react";

import { HandGraphic, Icon } from "@/components/Icon";
import { BlockRenderer } from "@/components/lms/LessonBlocks";
import {
  courseThemeAttributes,
  courseReadiness,
  buildInternalReferenceTargets,
  flattenLessons,
  inlineToPlainText,
  moveItem,
  newLesson,
  newModule,
  PLACEHOLDER_MARKER,
  pruneEmptyProse,
  newBlock,
  renumber,
  newTableRow,
  renumberSteps,
  todo,
  uniqueSlug,
  type Course,
  type CourseModule,
  type Lesson,
  type LessonBlock,
  type LessonBlockType,
  type RichTextNode,
} from "@/lms-core";
import { BuilderFailureNotice, BuilderNotice, BuilderShell } from "./BuilderShell";
import { BuilderContents } from "./BuilderContents";
import { BuilderMenu } from "./BuilderMenu";
import { FieldInput } from "./BuilderFields";
import { BuilderInlineEditor, type InternalReferenceOption, type SlashCommand } from "./BuilderInlineEditor";
import { BuilderEditableTitle } from "./BuilderEditableTitle";
import { BuilderBlockPicker } from "./BuilderBlockPicker";
import { InkLabel } from "./BuilderInkLabel";
import { importLessonFiles, loadCourse, saveCourse, type BuilderFailure } from "./builderClient";
import { BuilderGrip } from "./BuilderGrip";
import { BuilderHistory } from "./BuilderHistory";
import { BuilderToolRail, type BuilderToolMode } from "./BuilderToolRail";
import { useCourseAutosave } from "./useCourseAutosave";
import { rememberZenPreviewReturn, zenPreviewHref } from "@/components/lms/ZenPreviewShell";
import { useCourseHistory } from "./useCourseHistory";
import { landingIndex, useRowDrag, type DragRef, type RowDrag } from "./useRowDrag";
import {
  BLOCK_TYPE_HINTS,
  BLOCK_TYPE_LABELS,
  BLOCK_TYPE_ORDER,
  BLOCK_STRUCTURE_ORDER,
  BLOCK_TEMPLATE_ORDER,
  describeBlock,
  readPath,
  writePath,
} from "./blockFields";
import styles from "./Builder.module.css";
import { PlatformLoadingState } from "@/components/platform/PlatformLoadingState";
import { lessonDocumentFailureCopy } from "./lessonDocumentCopy";
import {
  clearDurableCourseDraft,
  inspectDurableCourseDraft,
  type DurableCourseDraft,
} from "./courseDraftStore";
import { BuilderDraftConflict } from "./BuilderDraftConflict";

type State =
  | { status: "loading" }
  | { status: "failed"; failure: BuilderFailure; detail?: string }
  | { status: "ready" };

const ids = () => crypto.randomUUID();
const trailTitle = (value: string, fallback: string) =>
  value.includes(PLACEHOLDER_MARKER) || value.trim() === "" ? fallback : value;

/**
 * The editor — the part of the builder an author actually spends time in.
 *
 * WHOLE-COURSE STATE, ONE LESSON ON SCREEN. The save contract is a complete
 * course (see the API route), so the editor holds the whole thing and edits one
 * lesson inside it. That is not a compromise: it is what makes "save" a single
 * atomic write that either validates as a course or does not happen — no state
 * where a lesson saved and the course it belongs to did not. It is also what
 * lets the previous/next arrows and the contents drawer exist at all: the whole
 * sequence is already here, so navigation costs no request.
 *
 * TEXT IS MARKUP, NOT PLAIN. Inline values round-trip through the dialect in
 * lib/lms/inlineMarkup.ts, which is covered by a test over every inline value in
 * both shipped courses. Flattening to plain text would have deleted emphasis
 * and links from two thirds of the real content on first save.
 */
export function BuilderLessonEditor({ slug, lessonSlug }: { slug: string; lessonSlug: string }) {
  const router = useRouter();
  const [state, setState] = useState<State>({ status: "loading" });
  const history = useCourseHistory();
  const { course, dirty } = history;
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [contentsOpen, setContentsOpen] = useState(false);
  const [structureCollapsed, setStructureCollapsed] = useState(false);
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  /**
   * WHICH LESSON IS ON SCREEN — state, not the route.
   *
   * The route used to be the only answer, and moving between two lessons of the
   * course therefore cost a full navigation: save the whole course over the
   * wire, wait for the server to render the page again, remount the editor,
   * refetch the course it had just sent. Seconds, to look at a lesson that was
   * already in memory — the editor holds the WHOLE course precisely so it
   * would not have to ask.
   *
   * So an in-course move is a state change, and the URL follows it via
   * `history.pushState`, which the App Router supports for exactly this. Deep
   * links, back and forward all still work: arriving by route seeds this state,
   * and `popstate` puts it back. Nothing is lost by not saving first — the
   * course is one document and autosave owns writing it.
   */
  const [activeSlug, setActiveSlug] = useState(lessonSlug);
  /**
   * Where to go once the lesson on screen stops existing.
   *
   * Held in state rather than navigated to on the spot, because the two things
   * have to happen in this order: the destination is computed from the course
   * as it still stands, the removal is applied, and only the render AFTER that
   * commit may leave. Navigating first would save the course with the lesson
   * still in it; navigating inside the same handler would route away from a
   * list that had not been rewritten yet.
   */
  const [leaveFor, setLeaveFor] = useState<string | null>(null);
  const [draftConflict, setDraftConflict] = useState<DurableCourseDraft | null>(null);
  const importPicker = useRef<HTMLInputElement>(null);
  const docRef = useRef<HTMLDivElement>(null);
  const draftGeneration = useRef<number | null>(null);
  const serverCourse = useRef<Course | null>(null);
  /** The block just created, so the caret can land in it instead of being aimed. */
  const [freshBlockId, setFreshBlockId] = useState<string | null>(null);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [insertPosition, setInsertPosition] = useState(0);
  const [toolMode, setToolMode] = useState<BuilderToolMode>("blocks");
  const [toolOpen, setToolOpen] = useState(true);
  const [blockSearch, setBlockSearch] = useState("");

  useEffect(() => {
    // Guarded, and awaiting before the first setState: a synchronous setState in
    // an effect cascades a render for a state the component already starts in.
    let cancelled = false;
    void (async () => {
      const result = await loadCourse(slug);
      if (cancelled) return;
      if (result.ok) {
        draftGeneration.current = result.data.draftGeneration;
        serverCourse.current = result.data.course;
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
          ? { status: "ready" }
          : { status: "failed", failure: result.failure, detail: result.detail }
      );
    })();
    return () => {
      cancelled = true;
    };
    // `history.reset` is stable; the course is reloaded only when the slug changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  // Plain derivation, not memoized: it is two array scans over a handful of
  // modules, and the shape the compiler could not memoize anyway.
  const located = course ? locateLesson(course, activeSlug) : null;

  /** Applies a change to one path inside the current lesson. */
  const editLesson = useCallback(
    (path: (string | number)[], value: unknown) => {
      if (!located) return;
      const full = ["modules", located.moduleIndex, "lessons", located.lessonIndex, ...path];
      // Coalesced by the path being written: a burst of typing in one field is
      // one undo, and moving to the next field starts a new one.
      history.edit(full.join("."), (current) => writePath(current, full, value));
      setNote(null);
    },
    [history, located]
  );

  /**
   * Replaces the block list wholesale — add, delete, reorder.
   *
   * `renumberSteps` runs on every one of those, because all three move a
   * protocol step's position: `step` is derived from where the block sits, the
   * same way `order` is derived from where a lesson sits.
   */
  const editBlocks = useCallback(
    (next: (blocks: LessonBlock[]) => LessonBlock[]) => {
      if (!located) return;
      const path = ["modules", located.moduleIndex, "lessons", located.lessonIndex, "blocks"];
      // No coalescing key: adding, deleting and reordering a block are each one
      // deliberate act, and merging two of them would take back a move the
      // author never asked to lose.
      history.edit(null, (current) =>
        writePath(current, path, renumberSteps(next(readPath(current, path) as LessonBlock[])))
      );
      setNote(null);
    },
    [history, located]
  );

  const insertBlock = useCallback(
    (position: number, type: LessonBlockType) => {
      // A text block starts empty, with the caret ready. Empty prose is pruned
      // before save, so opening a gap and changing one's mind is harmless.
      const block = type === "rich_text"
        ? { id: ids(), type, content: [{ kind: "p" as const, text: "" }] }
        : newBlock(type, ids);
      setFreshBlockId(block.id);
      setSelectedBlockId(block.id);
      if (type !== "rich_text") {
        setToolMode("block");
        setToolOpen(true);
      }
      editBlocks((blocks) => [
        ...blocks.slice(0, position),
        block,
        ...blocks.slice(position),
      ]);
    },
    [editBlocks]
  );

  /**
   * Blocks reorder within the lesson, and they land in a GAP.
   *
   * The row-to-row drop this hook offers is turned off here on purpose. A block
   * is a paragraph of a document, not a row of a table: what an author aims at
   * is the space between two blocks, and asking them to find the correct half
   * of the correct block instead is asking them to hit a target they cannot
   * see. The document owns the drop (see `nominateGap`), which is also what
   * lets a block carried from the palette and a block carried from the page
   * answer to exactly the same hint.
   */
  const blockDrag = useRowDrag(
    useCallback(() => undefined, []),
    { mime: BLOCK_MOVE_MIME, dropTargets: false, portraitClass: styles.dragPortrait }
  );

  /**
   * Which gap the carried block will land in.
   *
   * Nominated from the pointer's distance to each gap rather than from what it
   * happens to be over, so the hint appears the moment the drag starts moving
   * and the nearest gap claims it — the light pull the gesture needs to feel
   * aimed rather than dropped.
   */
  const [dropGap, setDropGap] = useState<number | null>(null);
  const blockList = useRef<HTMLDivElement>(null);

  const carriesBlock = (types: readonly string[]) =>
    types.includes(BUILDER_BLOCK_MIME) || types.includes(BLOCK_MOVE_MIME);

  const nominateGap = (clientY: number) => {
    const gaps = blockList.current?.querySelectorAll<HTMLElement>("[data-gap]");
    if (!gaps || gaps.length === 0) return null;
    let best: { position: number; distance: number } | null = null;
    gaps.forEach((gap) => {
      const rect = gap.getBoundingClientRect();
      const distance = Math.abs(clientY - (rect.top + rect.height / 2));
      const position = Number(gap.dataset.gap);
      if (!best || distance < best.distance) best = { position, distance };
    });
    return best === null ? null : (best as { position: number }).position;
  };

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

  const importIntoLesson = useCallback(
    async (file: File) => {
      if (!located || working) return;
      setBusy(true);
      setNote(null);
      const result = await importLessonFiles(slug, [file]);
      setBusy(false);
      if (!result.ok || !result.data.lessons[0]) {
        setNote(lessonDocumentFailureCopy(result.ok ? undefined : result.detail, "Не вдалося імпортувати документ в урок."));
        return;
      }

      const imported = result.data.lessons[0];
      const path = ["modules", located.moduleIndex, "lessons", located.lessonIndex];
      history.edit(null, (current) => {
        const existing = readPath(current, path) as Lesson;
        return writePath(current, path, {
          ...existing,
          title: imported.title,
          summary: imported.summary,
          durationMin: imported.durationMin,
          blocks: imported.blocks,
        });
      });
      setNote(`Імпортовано «${file.name}». Перевірте урок і збережіть зміни.`);
    },
    [history, located, slug, working]
  );

  /** Flushes the current snapshot and continues without asking a question. */
  /**
   * A whole-modules replacement, the way the course workspace applies one.
   *
   * No coalescing key: reordering and deleting are each one deliberate act and
   * merging two of them would take back a move the author never asked to lose.
   * `renumber` runs on every one of them because `order` and the day index are
   * derived from where a module and a lesson SIT.
   */
  const editModules = useCallback(
    (next: (course: Course) => CourseModule[]) => {
      history.edit(null, (current) => ({ ...current, modules: renumber(next(current)) }));
      setNote(null);
    },
    [history]
  );

  const navigate = useCallback(
    (href: string) => {
      setContentsOpen(false);
      if (!dirty) return router.push(href);
      if (pendingHref) return;
      setPendingHref(href);
      void save().then((saved) => {
        if (saved) router.push(href);
        else setPendingHref(null);
      });
    },
    [dirty, pendingHref, router, save]
  );

  /** `/build/<this course>/<lesson>` — and only that — is an in-course move. */
  const lessonSlugIn = useCallback(
    (href: string) => {
      const [path] = href.split(/[?#]/);
      const segments = path.split("/").filter(Boolean);
      if (segments.length !== 3 || segments[0] !== "build") return null;
      if (decodeURIComponent(segments[1]) !== slug) return null;
      return decodeURIComponent(segments[2]);
    },
    [slug]
  );

  /**
   * One entry point for everything that used to call `navigate`.
   *
   * Anything leaving the course still leaves the ordinary way — saved first,
   * then routed. Only a sibling lesson takes the short path, because only for a
   * sibling lesson is the destination already on this client.
   */
  const go = useCallback(
    (href: string) => {
      const target = lessonSlugIn(href);
      if (target === null) return navigate(href);
      setContentsOpen(false);
      if (target === activeSlug) return;
      setActiveSlug(target);
      window.history.pushState(null, "", href);
    },
    [activeSlug, lessonSlugIn, navigate]
  );

  // Arriving by route — a deep link, or a return from preview — seeds the
  // state; back and forward move it again.
  useEffect(() => {
    setActiveSlug(lessonSlug);
  }, [lessonSlug]);

  /**
   * The new lesson starts at its own beginning.
   *
   * A route change used to reset the scroller for free. Switching in place does
   * not, so an author moving from the end of a long lesson to a short one would
   * land somewhere in the middle of it — or below it entirely.
   */
  useEffect(() => {
    docRef.current?.closest("main")?.scrollTo({ top: 0 });
  }, [activeSlug]);

  useEffect(() => {
    const onPop = () => {
      const target = lessonSlugIn(window.location.pathname);
      if (target !== null) setActiveSlug(target);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [lessonSlugIn]);

  useEffect(() => {
    if (!leaveFor) return;
    setLeaveFor(null);
    go(leaveFor);
  }, [go, leaveFor]);

  const preview = () => {
    if (working) return;
    const returnTo = `/build/${encodeURIComponent(slug)}/${encodeURIComponent(activeSlug)}`;
    rememberZenPreviewReturn(returnTo);
    navigate(zenPreviewHref(`/learn/${encodeURIComponent(slug)}/${encodeURIComponent(activeSlug)}`, returnTo));
  };

  const recoverConflictingDraft = () => {
    if (!draftConflict || !serverCourse.current) return;
    history.recover(serverCourse.current, draftConflict.course);
    setDraftConflict(null);
    setNote("Локальну копію відновлено. Вона збережеться як поточна версія.");
  };

  const discardConflictingDraft = () => {
    if (!draftConflict) return;
    void clearDurableCourseDraft(draftConflict.courseId).catch(() => undefined);
    setDraftConflict(null);
    setNote("Залишено актуальну серверну версію.");
  };

  const trail = [
    { label: "Курси", href: "/build" },
    { label: slug, href: `/build/${slug}` },
  ];

  if (state.status === "loading") {
    return (
      <BuilderShell trail={trail}>
        <PlatformLoadingState label="Майстерня" title="Завантажуємо урок…" detail="Відновлюємо блоки уроку і останню збережену версію." />
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

  if (!course || !located) {
    return (
      <BuilderShell trail={trail}>
        <BuilderNotice title="Урок не знайдено" text={`У курсі немає уроку «${activeSlug}».`} />
      </BuilderShell>
    );
  }

  // Not named `module`: Next forbids shadowing the CommonJS global.
  const holder = course.modules[located.moduleIndex];
  const lesson = holder.lessons[located.lessonIndex] as Lesson;

  // The walk the author's own arrows follow: every lesson of the course in
  // stored order, reference modules included. The learner's sequence excludes
  // reference material; the AUTHOR's does not — a recipe list still has to be
  // reachable with one press from the lesson before it.
  const walk = flattenLessons(course);
  const position = walk.findIndex((entry) => entry.lesson.slug === lesson.slug);
  const selectedBlockIndex = lesson.blocks.findIndex((block) => block.id === selectedBlockId);
  const selectedBlock = selectedBlockIndex >= 0 ? lesson.blocks[selectedBlockIndex] : null;
  const readiness = courseReadiness(course);
  const referenceTargets = buildInternalReferenceTargets(course);
  const referenceOptions = internalReferenceOptions(referenceTargets, lesson.id, holder.id);

  const addLessonToModule = (moduleId: string) => {
    history.edit(null, (current) => {
      const taken = current.modules.flatMap((entry) => entry.lessons.map((item) => item.slug));
      const nextDay = Math.max(0, ...current.modules.flatMap((entry) => entry.lessons.map((item) => item.dayIndex ?? 0))) + 1;
      return {
        ...current,
        modules: current.modules.map((entry) => {
          if (entry.id !== moduleId) return entry;
          const order = entry.lessons.length + 1;
          const title = `Урок ${order}`;
          return {
            ...entry,
            lessons: [
              ...entry.lessons,
              newLesson(ids, {
                order,
                title,
                slug: uniqueSlug(title, taken),
                dayIndex: current.schedule.mode === "daily" && !entry.reference ? nextDay : undefined,
              }),
            ],
          };
        }),
      };
    });
  };

  const addCourseModule = () => {
    history.edit(null, (current) => {
      const order = current.modules.length + 1;
      const title = `Модуль ${order}`;
      const taken = current.modules.map((entry) => entry.slug);
      const nextDay = Math.max(0, ...current.modules.flatMap((entry) => entry.lessons.map((item) => item.dayIndex ?? 0))) + 1;
      return {
        ...current,
        modules: [
          ...current.modules,
          newModule(ids, {
            order,
            title,
            slug: uniqueSlug(title, taken),
            dayIndex: current.schedule.mode === "daily" ? nextDay : undefined,
          }),
        ],
      };
    });
  };

  const selectTool = (nextMode: BuilderToolMode) => {
    setToolMode(nextMode);
    setToolOpen(true);
  };

  /**
   * Selecting is not opening a panel.
   *
   * It used to be: pressing a block set the tool layer to its properties and
   * swung the drawer out, so the ordinary act of pointing at what you are
   * writing rearranged a third of the screen. Selection now only says WHICH
   * block the author means. Properties are asked for — from the block's own
   * menu, or by opening the panel on its properties tab.
   */
  const selectBlock = (blockId: string) => {
    setSelectedBlockId(blockId);
  };

  const openBlockProperties = (blockId: string) => {
    setSelectedBlockId(blockId);
    setToolMode("block");
    setToolOpen(true);
  };

  /** Which gap a palette press drops into. It does not open anything. */
  const activateInsert = (nextPosition: number) => {
    setInsertPosition(nextPosition);
  };

  return (
    <BuilderShell
      trail={[
        { label: "Курси", onNavigate: () => navigate("/build") },
        { label: trailTitle(course.title, "Курс без назви"), onNavigate: () => navigate(`/build/${slug}`) },
        { label: trailTitle(holder.title, "Модуль без назви") },
        { label: trailTitle(lesson.title, "Урок без назви") },
      ]}
      aside={
        <BuilderContents
          course={course}
          currentSlug={lesson.slug}
          onNavigate={go}
          onAddLesson={addLessonToModule}
          onAddModule={addCourseModule}
          editing={{ onModules: editModules, onNote: setNote, onLeaveCurrent: setLeaveFor }}
        />
      }
      asideOpen={contentsOpen}
      asideCollapsed={structureCollapsed}
      onAsideToggle={() => setStructureCollapsed((collapsed) => !collapsed)}
      pageMode="document"
      onNavigate={go}
      toolLayer={
        <BuilderToolRail
          mode={toolMode}
          open={toolOpen}
          onMode={selectTool}
          onClose={() => setToolOpen(false)}
        >
          <LessonToolContent
            mode={toolMode}
            course={course}
            lesson={lesson}
            selectedBlock={selectedBlock}
            selectedBlockIndex={selectedBlockIndex}
            search={blockSearch}
            insertPosition={insertPosition}
            working={working}
            importPicker={importPicker}
            onSearch={setBlockSearch}
            onInsert={insertBlock}
            onLessonChange={editLesson}
            onBlockChange={(path, value) => {
              if (selectedBlockIndex >= 0) editLesson(["blocks", selectedBlockIndex, ...path], value);
            }}
            onImport={importIntoLesson}
          />
        </BuilderToolRail>
      }
      tools={
        <>
          <button
            className={styles.workspacePreviewAction}
            type="button"
            onClick={preview}
            disabled={working}
            aria-label="Переглянути урок як учень"
            title={dirty ? "Зберегти й відкрити урок як учень" : "Відкрити урок як учень"}
          >
            <Icon name="eye" size={18} />
            <span className={styles.workspaceActionLabel}>Переглянути</span>
          </button>
          <span className={styles.workspaceSaveStatus} role="status" aria-live="polite">
            <Icon name="check" size={18} /> {autosave.saving ? "Зберігаємо…" : dirty ? "Є зміни" : "Збережено"}
          </span>
          <button className={styles.workspaceBlockers} type="button" onClick={() => navigate(`/build/${slug}#course-release`)}>
            <span aria-hidden="true">•</span> {readiness.blockers.length} блокери
          </button>
          {/* Hidden from 901px up, where the rail is simply there. A control
              that toggles something already visible is a control that does
              nothing the first time it is pressed. */}
          <button
            className={styles.contentsAction}
            type="button"
            aria-expanded={contentsOpen}
            onClick={() => setContentsOpen((open) => !open)}
          >
            <Icon name="menu" size={18} />
            <span className={styles.contentsCount}>
              {position + 1}/{walk.length}
            </span>
          </button>
        </>
      }
    >
      {draftConflict ? (
        <BuilderDraftConflict onRecover={recoverConflictingDraft} onDiscard={discardConflictingDraft} />
      ) : null}
      {/* THE DOCUMENT HEAD, and it is the document. The title used to be an
          `<h1>` echoing a «Назва» field in a panel below it: the same words
          twice, with the copy being the one you could change. Now the heading
          IS the input, and the lead under it is the lesson's own summary
          rather than a caption about it. */}
      {/* Keyed on the lesson, so moving to another one is a short dissolve
          rather than a swap. It is the only thing left standing in for the
          navigation that used to happen here: without it the document changes
          between two frames and the eye cannot tell whether it moved or the
          text was edited under it. */}
      <div className={`${styles.docHead} ${styles.docEnter}`} key={`head-${lesson.id}`} ref={docRef}>
        <BuilderEditableTitle
          value={lesson.title}
          label="Редагувати назву уроку"
          onChange={(value) => editLesson(["title"], value)}
        />
        <div className={styles.pageLead}>
          <BuilderInlineEditor
            bare
            multiline
            value={lesson.summary}
            label="Короткий опис уроку"
            placeholder="Про що цей урок — одне-два речення."
            onChange={(next) => editLesson(["summary"], next)}
          />
        </div>
      </div>

      <div
        ref={blockList}
        className={`${styles.blockList} ${styles.docEnter}`}
        key={`blocks-${lesson.id}`}
        onDragOver={(event) => {
          if (!carriesBlock(event.dataTransfer.types)) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = event.dataTransfer.types.includes(BUILDER_BLOCK_MIME) ? "copy" : "move";
          setDropGap(nominateGap(event.clientY));
        }}
        onDragLeave={(event) => {
          // Only when the pointer has genuinely left the document: `dragleave`
          // also fires crossing between two blocks inside it, and clearing on
          // that makes the hint flicker all the way down the lesson.
          if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
          setDropGap(null);
        }}
        onDrop={(event) => {
          if (!carriesBlock(event.dataTransfer.types)) return;
          event.preventDefault();
          const gap = nominateGap(event.clientY);
          setDropGap(null);
          if (gap === null) return;
          const added = event.dataTransfer.getData(BUILDER_BLOCK_MIME) as LessonBlockType;
          if (BLOCK_TYPE_ORDER.includes(added)) {
            activateInsert(gap);
            insertBlock(gap, added);
            return;
          }
          const moved = Number(event.dataTransfer.getData(BLOCK_MOVE_MIME).split(":").at(-1));
          if (!Number.isInteger(moved)) return;
          // The gap names a place in the list the author is LOOKING at, which
          // still contains the block being carried.
          const target = moved < gap ? gap - 1 : gap;
          if (target === moved) return;
          editBlocks((blocks) => moveItem(blocks, moved, target));
        }}
        {...courseThemeAttributes(course.theme)}
      >
        <BlockInsert position={0} drop={dropGap === 0} onActivate={activateInsert} onAdd={insertBlock} />
        {lesson.blocks.map((block, index) => (
          <Fragment key={block.id}>
            <BlockEditor
              block={block}
              index={index}
              total={lesson.blocks.length}
              drag={blockDrag}
              fresh={block.id === freshBlockId}
              selected={block.id === selectedBlockId}
              referenceOptions={referenceOptions}
              referenceTargets={referenceTargets}
              courseSlug={course.slug}
              onSelect={() => selectBlock(block.id)}
              onProperties={() => openBlockProperties(block.id)}
              onChange={editLesson}
              onBlocks={editBlocks}
              onInsertAfter={(type) => insertBlock(index + 1, type)}
            />
            <BlockInsert position={index + 1} drop={dropGap === index + 1} onActivate={activateInsert} onAdd={insertBlock} />
          </Fragment>
        ))}
      </div>

      <div className={styles.saveBar}>
        {pendingHref ? (
          <span className={styles.saveState} role="status" aria-live="polite">
            Зберігаємо зміни перед переходом…
          </span>
        ) : (
          <>
            <BuilderHistory history={history} disabled={working} />
            <span className={styles.saveState} role="status" aria-live="polite">
              {note ?? autosave.message ?? (dirty ? "Зміни збережуться автоматично" : "Усі зміни збережено")}
            </span>
            <button className={styles.commitAction} type="button" onClick={() => void save()} disabled={working || !dirty}>
              {autosave.saving ? "Зберігаємо…" : "Зберегти зараз"}
            </button>
          </>
        )}
      </div>
    </BuilderShell>
  );
}

function locateLesson(course: Course, lessonSlug: string): { moduleIndex: number; lessonIndex: number } | null {
  for (let moduleIndex = 0; moduleIndex < course.modules.length; moduleIndex += 1) {
    const lessonIndex = course.modules[moduleIndex].lessons.findIndex((lesson) => lesson.slug === lessonSlug);
    if (lessonIndex >= 0) return { moduleIndex, lessonIndex };
  }
  return null;
}

const BUILDER_BLOCK_MIME = "application/x-centerway-block";

/**
 * What the pointer carries out of the palette.
 *
 * The browser's default drag image for a palette row is a snapshot of that
 * row — a wide strip of the tool panel, dragged across a manuscript, saying
 * nothing about what is being placed. A block already in the document drags
 * its own snapshot and therefore looks like the thing it is; this gives a
 * block coming FROM the palette the same courtesy: a small chip with its name,
 * under the cursor.
 *
 * Detached and removed on the next frame, because `setDragImage` only needs the
 * element to be rendered at the moment it is called, and one left in the
 * document would sit at the bottom of the page for the rest of the session.
 */
function carryChip(event: DragEvent<HTMLElement>, label: string) {
  if (typeof document === "undefined") return;
  const chip = document.createElement("div");
  chip.className = styles.dragChip;
  chip.textContent = label;
  document.body.append(chip);
  event.dataTransfer.setDragImage(chip, 12, 16);
  requestAnimationFrame(() => chip.remove());
}
/** A block already in the lesson, on its way to another gap in it. */
const BLOCK_MOVE_MIME = "application/x-centerway-block-move";

function LessonToolContent({
  mode,
  course,
  lesson,
  selectedBlock,
  selectedBlockIndex,
  search,
  insertPosition,
  working,
  importPicker,
  onSearch,
  onInsert,
  onLessonChange,
  onBlockChange,
  onImport,
}: {
  mode: BuilderToolMode;
  course: Course;
  lesson: Lesson;
  selectedBlock: LessonBlock | null;
  selectedBlockIndex: number;
  search: string;
  insertPosition: number;
  working: boolean;
  importPicker: { current: HTMLInputElement | null };
  onSearch: (value: string) => void;
  onInsert: (position: number, type: LessonBlockType) => void;
  onLessonChange: (path: (string | number)[], value: unknown) => void;
  onBlockChange: (path: (string | number)[], value: unknown) => void;
  onImport: (file: File) => Promise<void>;
}) {
  if (mode === "blocks") {
    const query = search.trim().toLocaleLowerCase("uk");
    const visibleTypes = BLOCK_TYPE_ORDER.filter((type) =>
      `${BLOCK_TYPE_LABELS[type]} ${BLOCK_TYPE_HINTS[type]}`.toLocaleLowerCase("uk").includes(query)
    );
    const groups = [
      { title: "Текст і медіа", types: visibleTypes.filter((type) => type === "rich_text" || BLOCK_STRUCTURE_ORDER.includes(type)) },
      { title: "Практика і навчання", types: visibleTypes.filter((type) => BLOCK_TEMPLATE_ORDER.includes(type)) },
    ];

    return (
      <div className={styles.toolStack}>
        <label className={styles.toolSearch}>
          <Icon name="view-rows" size={18} />
          <input value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Знайти блок…" />
        </label>
        <p className={styles.toolHint}>Додасться в обрану позицію {insertPosition + 1}. Перетягніть блок на знак + або натисніть його.</p>
        {groups.map((group) => group.types.length > 0 ? (
          <section className={styles.toolGroup} key={group.title}>
            <h3>{group.title}</h3>
            <div className={styles.toolLibrary}>
              {group.types.map((type) => (
                <button
                  className={styles.toolBlock}
                  type="button"
                  key={type}
                  draggable
                  onDragStart={(event) => {
                    event.dataTransfer.effectAllowed = "copy";
                    event.dataTransfer.setData(BUILDER_BLOCK_MIME, type);
                    carryChip(event, BLOCK_TYPE_LABELS[type]);
                  }}
                  onClick={() => onInsert(insertPosition, type)}
                >
                  <Icon name={type === "practice_block" ? "motion" : type === "boundary_note" ? "boundary" : "document"} size={20} />
                  <span><InkLabel strong>{BLOCK_TYPE_LABELS[type]}</InkLabel><small>{BLOCK_TYPE_HINTS[type]}</small></span>
                  <Icon name="grip" size={16} />
                </button>
              ))}
            </div>
          </section>
        ) : null)}
        {visibleTypes.length === 0 ? <p className={styles.toolEmpty}>Нічого не знайдено. Спробуйте коротшу назву.</p> : null}
      </div>
    );
  }

  if (mode === "block") {
    if (!selectedBlock || selectedBlockIndex < 0) {
      return <p className={styles.toolEmpty}>Оберіть блок у документі — тут з’являться його властивості.</p>;
    }
    /* PROPERTIES, NOT CONTENT. What a block SAYS is edited at the block, in the
       document; what is left here is what the block IS — where it sits, what it
       is called in the data, and how often it comes back. A panel that also
       held the words meant the author read the table on one side of the screen
       and typed it on the other. */
    return (
      <div className={styles.toolStack}>
        <div className={styles.toolSelectionTitle}>
          <Icon name="boundary" size={20} />
          <span><small>Блок {selectedBlockIndex + 1}</small><strong>{BLOCK_TYPE_LABELS[selectedBlock.type]}</strong></span>
        </div>
        <p className={styles.toolHint}>{BLOCK_TYPE_HINTS[selectedBlock.type]}</p>
        <RepeatControls block={selectedBlock} onChange={onBlockChange} />
        <p className={styles.toolHint}>
          {selectedBlock.type === "rich_text"
            ? "Текст редагується просто на сторінці."
            : "Вміст блоку редагується під ним у документі — оберіть блок."}
        </p>
      </div>
    );
  }

  if (mode === "page") {
    return (
      <div className={styles.toolStack}>
        <button className={styles.quietAction} type="button" disabled={working} onClick={() => importPicker.current?.click()}>
          <Icon name="import" size={20} /> Імпортувати документ
        </button>
        <input
          ref={importPicker}
          className={styles.visuallyHidden}
          type="file"
          accept=".md,.markdown,.docx,.txt,text/markdown,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          tabIndex={-1}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void onImport(file);
          }}
        />
        <FieldInput
          field={{
            path: ["dayIndex"],
            label: "День курсу",
            kind: "number",
            hint: course.schedule.mode === "daily" ? "День програми; пропуски можуть бути навмисними." : "Використовується лише в курсах з розкладом по днях.",
          }}
          value={lesson.dayIndex}
          onChange={onLessonChange}
        />
        <FieldInput field={{ path: ["durationMin"], label: "Тривалість, хв", kind: "number" }} value={lesson.durationMin} onChange={onLessonChange} />
        <p className={styles.readOnlyNote}>Адреса: <code>/learn/{course.slug}/{lesson.slug}</code><br />Закріплена для посилань і нагадувань.</p>
      </div>
    );
  }

  return null;
}

/**
 * Adding to the lesson.
 *
 * IT USED TO ASK FIRST. The one control here opened a grid of twelve cards and
 * would not let a word be written until one was chosen — a lesson began with a
 * taxonomy question. An author does not know what kind of thing they are
 * writing before they have written it.
 *
 * So the default is text, immediately, with the caret in it. The SHAPES a
 * paragraph cannot take are one "/" away. And the third door, here, is for
 * TEMPLATES — the blocks that arrive already knowing what job they do. That is
 * a different question, deliberately asked in a different place: choosing
 * «Крок протоколу» is a decision about the lesson's structure, and the grid,
 * with the sentence that says when to reach for each, is the right shape for a
 * decision. It is the wrong shape for "I need a table here".
 */
/**
 * The gap between two blocks.
 *
 * Silent until it is asked for. A ring parked in every gap, with a rule
 * permanently drawn above the first block, made the manuscript read as a form
 * with slots in it — and the chooser it opened used to replace the gap in the
 * flow, so pressing it threw the rest of the lesson down the page. The ring
 * appears on pointing, the rule is drawn with it, and the chooser floats.
 */
function BlockInsert({
  position,
  drop,
  onActivate,
  onAdd,
}: {
  position: number;
  /** The list has nominated this gap as where the carried block lands. */
  drop?: boolean;
  onActivate: (position: number) => void;
  onAdd: (position: number, type: LessonBlockType) => void;
}) {
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const ring = useRef<HTMLButtonElement>(null);

  return (
    <div className={styles.blockInsert} data-open={anchor ? "" : undefined} data-drop={drop || undefined} data-gap={position}>
      <button
        ref={ring}
        className={styles.blockInsertAction}
        type="button"
        aria-label="Додати блок"
        title="Додати блок"
        aria-expanded={anchor !== null}
        onClick={() => {
          onActivate(position);
          setAnchor(ring.current?.getBoundingClientRect() ?? null);
        }}
      >
        <Icon name="plus" size={18} />
        <HandGraphic className={styles.blockInsertInkRing} name="ink-ring" size={42} />
      </button>
      {anchor ? (
        <BuilderBlockPicker
          anchor={anchor}
          onPick={(type) => {
            onAdd(position, type);
            setAnchor(null);
          }}
          onClose={() => setAnchor(null)}
        />
      ) : null}
    </div>
  );
}

function BlockEditor({
  block,
  index,
  total,
  drag,
  fresh,
  selected,
  referenceOptions,
  referenceTargets,
  courseSlug,
  onSelect,
  onProperties,
  onChange,
  onBlocks,
  onInsertAfter,
}: {
  block: LessonBlock;
  index: number;
  total: number;
  drag: RowDrag;
  /** Just added by the author — the caret belongs in its first node. */
  fresh?: boolean;
  selected?: boolean;
  referenceOptions: InternalReferenceOption[];
  referenceTargets: ReturnType<typeof buildInternalReferenceTargets>;
  courseSlug: string;
  onSelect: () => void;
  /** Selects the block AND brings its properties up in the tool panel. */
  onProperties: () => void;
  onChange: (path: (string | number)[], value: unknown) => void;
  onBlocks: (next: (blocks: LessonBlock[]) => LessonBlock[]) => void;
  onInsertAfter: (type: LessonBlockType) => void;
}) {
  const editField = (path: (string | number)[], value: unknown) => onChange(["blocks", index, ...path], value);

  /* The field descriptors are already the one place that knows what each
     address is CALLED; an empty leaf in the document borrows that name as its
     placeholder rather than inventing a second vocabulary. */
  const described = describeBlock(block);
  const labels = new Map(described.map((field) => [field.path.join("."), field.label]));
  /* What the rendering could not take over: numbers, media, links, flags — and
     any inline leaf the renderer never draws (`offPage`). They stay a short
     form under the block. */
  const residual = described.filter((field) => field.kind !== "inline" || field.offPage === true);

  const row: DragRef = { list: "block", group: 0, index };

  return (
    <section
      id={`block-${block.id}`}
      className={`${styles.blockCard} ${styles.dragRow}`}
      data-selected={selected || undefined}
      /* SELECTION FOLLOWS THE CARET, not only the pointer. A prose block has no
         read-only preview to click — its fields ARE its surface — so a click
         handler on the preview selected every block except the one an author
         spends most of their time in. Focus anywhere inside says «this is the
         block I mean» for every type, and typing is the strongest possible
         statement of that. */
      onFocusCapture={onSelect}
      {...drag.rowProps(row)}
    >
      {/* THE HANDLE RAIL, and it is not a header.
          It used to be a permanent row above every block carrying the type in
          mono caps — «МЕТА УРОКУ» over a lesson goal, «ТАБЛИЦЯ» over a table.
          The block already says what it is by being one, so the label was a
          line of filler on top of every block in the document, and the row it
          sat in pushed the content down by its own height on every block.
          What is left is the grip and the menu, in the margin, asked for by
          pointing at the block or selecting it. */}
      <div className={styles.blockRail} aria-hidden={undefined}>
        <BuilderGrip drag={drag} row={row} label={BLOCK_TYPE_LABELS[block.type]} />
        <BuilderMenu
          label={`Дії з блоком «${BLOCK_TYPE_LABELS[block.type]}»`}
          items={[
            {
              label: "Властивості блоку",
              icon: "settings" as const,
              hint: "Налаштування блоку в панелі праворуч",
              onSelect: onProperties,
            },
            { label: "Підняти вище", icon: "arrow-up" as const, disabled: index === 0, onSelect: () => onBlocks((blocks) => moveItem(blocks, index, index - 1)) },
            { label: "Опустити нижче", icon: "arrow-down" as const, disabled: index === total - 1, onSelect: () => onBlocks((blocks) => moveItem(blocks, index, index + 1)) },
            {
              label: "Видалити блок",
              icon: "trash",
              danger: true,
              // A lesson with no blocks fails `validateCourse`, and the author
              // would meet that as a save error rather than a disabled item.
              disabled: total === 1,
              onSelect: () => onBlocks((blocks) => blocks.filter((_, position) => position !== index)),
            },
          ]}
        />
      </div>

      {block.type === "rich_text" ? (
        <RichTextEditor
          block={block}
          fresh={fresh}
          blockCommands={BLOCK_COMMANDS}
          referenceOptions={referenceOptions}
          /* A block type chosen from inside the prose adds a NEW block after
             this one rather than converting it. Converting would throw away
             every paragraph the author had written to get here. */
          onBlockCommand={(id) => {
            const type = id.slice("block:".length) as LessonBlock["type"];
            onInsertAfter(type);
          }}
          onChange={editField}
        />
      ) : (
        <>
          {/* THE BLOCK IS THE EDITOR. It is the learner's own rendering, with
              every addressed text leaf handed back as a field — so a table is
              typed in the table and a practice in the practice, at the size and
              face they will be read at. There is no editable twin of these
              thirteen types to drift away from the ones above. */}
          <div className={styles.builderLearnerBlock} onClick={onSelect}>
            <BlockRenderer
              block={block}
              checklist={{}}
              onToggleChecklistItem={() => undefined}
              disabled
              courseSlug={courseSlug}
              referenceTargets={referenceTargets}
              referenceRoute="build"
              authoring={{
                field: (path, value) => (
                  <BuilderInlineEditor
                    bare
                    phrasing
                    key={path.join(".")}
                    value={typeof value === "string" ? value : ""}
                    label={labels.get(path.join(".")) ?? "Текст блоку"}
                    placeholder={labels.get(path.join(".")) ?? "Текст"}
                    references={referenceOptions}
                    onChange={(next) => editField(path, next)}
                  />
                ),
              }}
            />
          </div>
          {/* THE FIELDS ARE AT THE BLOCK, not in a panel beside it.
              They used to live in the right drawer, which meant editing the
              words of a table happened three hundred pixels away from the
              table — the author read one thing and typed into another, and
              the block they were changing was behind whichever panel state
              they had left open. Selecting the block opens them under it, in
              the document, in the place the change will appear. The drawer
              keeps what is genuinely a PROPERTY of the block rather than its
              content. */}
          {selected && residual.length > 0 ? (
            <div className={styles.blockFields}>
              {residual.map((field) => (
                <FieldInput
                  key={field.path.join(".")}
                  field={field}
                  value={readPath(block, field.path)}
                  courseSlug={courseSlug}
                  onChange={editField}
                />
              ))}
            </div>
          ) : null}
        </>
      )}

      {block.type === "rich_text" ? <RepeatControls block={block} onChange={editField} /> : null}
    </section>
  );
}

const NODE_LABELS: Record<RichTextNode["kind"], string> = {
  p: "Абзац",
  h3: "Підзаголовок",
  ul: "Список",
  ol: "Нумерований список",
};

function internalReferenceOptions(
  targets: ReturnType<typeof buildInternalReferenceTargets>,
  currentLessonId: string,
  currentModuleId: string
): InternalReferenceOption[] {
  const current = targets.find((target) => target.kind === "lesson" && target.lessonId === currentLessonId);
  if (!current) return [];

  const rank = (target: (typeof targets)[number]): number => {
    if (target.lessonIndex === current.lessonIndex - 1) return 0;
    if (target.lessonIndex < current.lessonIndex) return 1;
    if (target.moduleId === currentModuleId) return 2;
    if (!target.referenceModule) return 3;
    return 4;
  };
  const group = (target: (typeof targets)[number]): string => {
    const value = rank(target);
    if (value === 0) return "Попередній урок";
    if (value === 1) return "Раніше в курсі";
    if (value === 2) return "Поточний модуль";
    if (value === 3) return "Увесь курс";
    return "Матеріали CenterWay";
  };

  return targets
    .filter((target) => target.lessonId !== currentLessonId)
    .sort((left, right) => {
      const groupOrder = rank(left) - rank(right);
      if (groupOrder !== 0) return groupOrder;
      if (rank(left) <= 1 && left.lessonIndex !== right.lessonIndex) return right.lessonIndex - left.lessonIndex;
      if (left.lessonIndex !== right.lessonIndex) return left.lessonIndex - right.lessonIndex;
      if (left.kind !== right.kind) return left.kind === "lesson" ? -1 : 1;
      return left.label.localeCompare(right.label, "uk");
    })
    .map((target) => ({
      key: target.key,
      label: target.label,
      group: group(target),
      hint: target.kind === "lesson"
        ? target.moduleTitle
        : `${target.lessonTitle} · ${target.moduleTitle}`,
      future: target.lessonIndex > current.lessonIndex && !target.referenceModule,
    }));
}

/**
 * What "/" offers first: the four shapes a paragraph can become.
 *
 * These change the node in place and keep the words. The block types the
 * lesson also knows come after them, added by `BlockEditor`, because reaching
 * for «Таблиця» halfway through a sentence is rarer than reaching for a list.
 */
/**
 * The shapes prose cannot take, offered under the node kinds.
 *
 * STRUCTURE ONLY — a table, a video, an image, a quote, a button. The blocks
 * that arrive carrying a ROLE (мета уроку, крок протоколу, чек-лист, межі) are
 * templates, not shapes, and they are NOT here: mid-sentence the author is
 * asking "what shape is this", and a list that answers two questions at once
 * makes both answers harder to find. Templates live behind «Шаблон…».
 */
const BLOCK_COMMANDS: SlashCommand[] = BLOCK_STRUCTURE_ORDER.map((type) => ({
  id: `block:${type}`,
  label: BLOCK_TYPE_LABELS[type],
  hint: BLOCK_TYPE_HINTS[type],
  group: "Блоки",
}));

const NODE_COMMANDS: SlashCommand[] = [
  { id: "p", label: "Абзац", hint: "Звичайний текст.", group: "Текст" },
  { id: "h3", label: "Підзаголовок", hint: "Ділить урок на частини.", group: "Текст" },
  { id: "ul", label: "Список", hint: "Перелік, у якому порядок не важить.", group: "Текст" },
  { id: "ol", label: "Нумерований список", hint: "Кроки, які йдуть по черзі.", group: "Текст" },
];

/**
 * The rich-text block, edited as a document rather than as a form over one.
 *
 * A `rich_text` block is a SEQUENCE of paragraphs, headings and lists. It used
 * to be drawn as a stack of labelled fields with a kind dropdown on each — a
 * form whose subject happened to be prose. Now the node renders AS the thing it
 * is, Enter makes the next one, and the controls that describe it (kind, move,
 * delete) hide until the pointer is on the row.
 *
 * THE THREE DOCUMENT KEYS. Enter opens the next node — a new paragraph after a
 * paragraph, the next item inside a list, and, on an already-empty item, the
 * way OUT of the list into a paragraph, because a list with no exit is a trap.
 * Backspace on an empty node removes it and puts the caret at the end of the
 * one before. "/" opens the menu. None of that is decided by the field itself:
 * the field hands the key up (see `BuilderInlineEditor`) and this component,
 * which knows the sequence, decides what the key meant.
 *
 * Turning a paragraph into a heading is a KIND change and not a new node: it
 * keeps the text the author already wrote, which is what "this line is actually
 * a heading" means.
 */
function RichTextEditor({
  block,
  fresh,
  blockCommands,
  referenceOptions,
  onBlockCommand,
  onChange,
}: {
  block: Extract<LessonBlock, { type: "rich_text" }>;
  fresh?: boolean;
  /** Offered in the slash menu below the node kinds — see `BlockEditor`. */
  blockCommands?: SlashCommand[];
  referenceOptions: InternalReferenceOption[];
  onBlockCommand?: (id: string) => void;
  onChange: (path: (string | number)[], value: unknown) => void;
}) {
  const setContent = (next: RichTextNode[]) => onChange(["content"], next);

  /**
   * Which field should hold the caret after the next render.
   *
   * An address, not a ref: the node that needs focus usually does not exist yet
   * when the key is pressed. `"2"` is the third node, `"2:1"` its second item.
   */
  const [focus, setFocus] = useState<string | null>(fresh ? "0" : null);

  /**
   * Nodes reorder within their own block only.
   *
   * No `crossGroup`: one rich-text block is on screen per card, and a node
   * carried into a neighbouring block would be a move between two different
   * pieces of prose — a thing the author would have to undo more often than
   * they meant it. The block itself is the unit that travels.
   */
  const drag = useRowDrag((from, to, edge) =>
    setContent(moveItem(block.content, from.index, landingIndex(from.index, to.index, edge, true)))
  );

  const commands: SlashCommand[] = [...NODE_COMMANDS, ...(blockCommands ?? [])];

  const runCommand = (index: number, id: string) => {
    if (id.startsWith("block:")) {
      onBlockCommand?.(id);
      return;
    }
    setContent(changeNodeKind(block.content, index, id as RichTextNode["kind"]));
    setFocus(id === "ul" || id === "ol" ? `${index}:0` : `${index}`);
  };

  /** A new paragraph after `index`, which is what Enter means outside a list. */
  const openParagraph = (index: number) => {
    const next = [...block.content];
    next.splice(index + 1, 0, { kind: "p", text: "" });
    setContent(next);
    setFocus(`${index + 1}`);
  };

  const removeNode = (index: number) => {
    if (block.content.length === 1) return;
    setContent(block.content.filter((_, position) => position !== index));
    // The end of what came before — where the caret would have gone if the
    // empty node had never been there.
    const target = Math.max(0, index - 1);
    const previous = block.content[target];
    setFocus(
      previous.kind === "ul" || previous.kind === "ol" ? `${target}:${previous.items.length - 1}` : `${target}`
    );
  };

  return (
    <div className={styles.nodeList}>
      {block.content.map((node, index) => {
        const row: DragRef = { list: "node", group: 0, index };
        const isList = node.kind === "ul" || node.kind === "ol";

        return (
          <div className={`${styles.nodeCard} ${styles.dragRow}`} key={index} {...drag.rowProps(row)}>
            {/* Grip and menu, revealed by the row. A paragraph should look like
                a paragraph until the author reaches for it; the kind selector
                that used to sit here made every line of prose wear a form
                control. The kind now lives in the menu, where it is reachable
                by touch as well as by "/". */}
            <div className={styles.nodeHead}>
              {/* The handle, and nothing else. The kind was written beside it
                  in mono caps — «АБЗАЦ» over a paragraph, «СПИСОК» over a list
                  — which is the same filler the block heads carried: a list has
                  bullets and a subheading is bigger, so the label told the
                  author what they were already looking at. The menu still says
                  the kind, in the one place where it is a question. */}
              <BuilderGrip drag={drag} row={row} label={NODE_LABELS[node.kind]} />
              <BuilderMenu
                label={`Дії з ${NODE_LABELS[node.kind].toLowerCase()}`}
                items={[
                  ...(Object.keys(NODE_LABELS) as RichTextNode["kind"][]).map((kind) => ({
                    label: NODE_LABELS[kind],
                    disabled: kind === node.kind,
                    onSelect: () => runCommand(index, kind),
                  })),
                  { label: "Підняти вище", icon: "arrow-up" as const, disabled: index === 0, onSelect: () => setContent(moveItem(block.content, index, index - 1)) },
                  { label: "Опустити нижче", icon: "arrow-down" as const, disabled: index === block.content.length - 1, onSelect: () => setContent(moveItem(block.content, index, index + 1)) },
                  { label: "Видалити", icon: "trash" as const, danger: true, disabled: block.content.length === 1, onSelect: () => setContent(block.content.filter((_, position) => position !== index)) },
                ]}
              />
            </div>

            {isList ? (
              <ul className={node.kind === "ol" ? styles.nodeOl : styles.nodeUl}>
                {node.items.map((item, itemIndex) => (
                  <li className={styles.nodeItem} key={itemIndex}>
                    <BuilderInlineEditor
                      bare
                      value={item}
                      label={`${NODE_LABELS[node.kind]} — пункт ${itemIndex + 1}`}
                      placeholder={itemIndex === 0 ? "Пункт" : undefined}
                      autoFocus={focus === `${index}:${itemIndex}`}
                      commands={commands}
                      references={referenceOptions}
                      onCommand={(id) => runCommand(index, id)}
                      onChange={(next) =>
                        onChange(
                          ["content", index, "items"],
                          node.items.map((current, position) => (position === itemIndex ? next ?? "" : current))
                        )
                      }
                      onEnter={() => {
                        // An empty item means "I am done with this list". The
                        // item goes and a paragraph opens after the whole node,
                        // which is the only exit a list has.
                        if (inlineToPlainText(item ?? "") === "" && node.items.length > 1) {
                          const trimmed = node.items.filter((_, position) => position !== itemIndex);
                          const next = [...block.content];
                          next[index] = { kind: node.kind, items: trimmed };
                          next.splice(index + 1, 0, { kind: "p", text: "" });
                          setContent(next);
                          setFocus(`${index + 1}`);
                          return;
                        }
                        const items = [...node.items];
                        items.splice(itemIndex + 1, 0, "");
                        onChange(["content", index, "items"], items);
                        setFocus(`${index}:${itemIndex + 1}`);
                      }}
                      onEmptyBackspace={() => {
                        if (node.items.length === 1) {
                          // The last item of a list is not deleted, it is
                          // demoted: a list of nothing is not a shape the
                          // validator accepts, and an author pressing backspace
                          // means "this is not a list", not "erase this".
                          setContent(changeNodeKind(block.content, index, "p"));
                          setFocus(`${index}`);
                          return;
                        }
                        onChange(
                          ["content", index, "items"],
                          node.items.filter((_, position) => position !== itemIndex)
                        );
                        setFocus(`${index}:${Math.max(0, itemIndex - 1)}`);
                      }}
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <div className={node.kind === "h3" ? styles.nodeHeading : undefined}>
                <BuilderInlineEditor
                  bare
                  multiline={node.kind !== "h3"}
                  value={node.text}
                  label={NODE_LABELS[node.kind]}
                  placeholder={node.kind === "h3" ? "Підзаголовок" : "Пишіть, або «/» для команд"}
                  autoFocus={focus === `${index}`}
                  commands={commands}
                  references={referenceOptions}
                  onCommand={(id) => runCommand(index, id)}
                  onChange={(next) => onChange(["content", index, "text"], next ?? "")}
                  onEnter={() => openParagraph(index)}
                  onEmptyBackspace={() => removeNode(index)}
                />
              </div>
            )}
          </div>
        );
      })}

      {/* The only add control left. Everything else the author might want here
          is one "/" away, and a row of four buttons under every block was the
          picker problem in miniature: choose the shape before writing a word. */}
      <button className={styles.addAction} type="button" onClick={() => openParagraph(block.content.length - 1)}>
        <span className={styles.addGlyph} aria-hidden="true">+</span> Абзац
      </button>
    </div>
  );
}

/**
 * Changes a node's kind while keeping what the author wrote.
 *
 * Text becomes a one-item list; a list becomes its items joined by a line
 * break, which the inline model cannot carry — so they are joined with «; »
 * instead of silently dropping every item but the first.
 */
function changeNodeKind(content: RichTextNode[], index: number, kind: RichTextNode["kind"]): RichTextNode[] {
  const node = content[index];
  if (node.kind === kind) return content;

  const carried: RichTextNode =
    kind === "ul" || kind === "ol"
      ? { kind, items: node.kind === "ul" || node.kind === "ol" ? node.items : [node.text] }
      : {
          kind,
          text: node.kind === "ul" || node.kind === "ol" ? node.items.map(inlineToPlainText).join("; ") : node.text,
        };

  const next = [...content];
  next[index] = carried;
  return next;
}



/**
 * The "add another one" controls for blocks that hold a list of their own.
 *
 * Kept apart from the field table because they are structural: the table says
 * what an existing item's fields are, and nothing in it can say "there should
 * be a fourth item". Without these, a checklist authored with three items was
 * a checklist that could never have four.
 */
function RepeatControls({
  block,
  onChange,
}: {
  block: LessonBlock;
  onChange: (path: (string | number)[], value: unknown) => void;
}) {
  if (block.type === "checklist") {
    return (
      <div className={styles.nodeAdd}>
        <button
          className={styles.addAction}
          type="button"
          onClick={() => onChange(["items"], [...block.items, { id: ids(), text: todo("пункт") }])}
        >
          <span className={styles.addGlyph} aria-hidden="true">+</span> Пункт
        </button>
        <button
          className={styles.addAction}
          type="button"
          disabled={block.items.length === 1}
          onClick={() => onChange(["items"], block.items.slice(0, -1))}
        >
          − Останній пункт
        </button>
      </div>
    );
  }

  if (block.type === "faq_block") {
    return (
      <div className={styles.nodeAdd}>
        <button
          className={styles.addAction}
          type="button"
          onClick={() =>
            onChange(["items"], [...block.items, { id: ids(), question: todo("питання"), answer: todo("відповідь") }])
          }
        >
          <span className={styles.addGlyph} aria-hidden="true">+</span> Питання
        </button>
        <button
          className={styles.addAction}
          type="button"
          disabled={block.items.length === 1}
          onClick={() => onChange(["items"], block.items.slice(0, -1))}
        >
          − Останнє питання
        </button>
      </div>
    );
  }

  if (block.type === "table") {
    const columns = block.head?.length ?? block.rows[0]?.length ?? 1;
    return (
      <div className={styles.nodeAdd}>
        <button
          className={styles.addAction}
          type="button"
          onClick={() => onChange(["rows"], [...block.rows, newTableRow(columns)])}
        >
          <span className={styles.addGlyph} aria-hidden="true">+</span> Рядок
        </button>
        <button
          className={styles.addAction}
          type="button"
          disabled={block.rows.length === 1}
          onClick={() => onChange(["rows"], block.rows.slice(0, -1))}
        >
          − Останній рядок
        </button>
        {/* A column is added to the header AND to every row in one act: the
            validator rejects a ragged table, so doing either alone would
            produce a course that cannot be saved. A table with no header keeps
            none — growing one here would give it a single heading cell over N
            columns, which is the ragged shape from the other direction. */}
        <button
          className={styles.addAction}
          type="button"
          onClick={() => {
            if (block.head) onChange(["head"], [...block.head, todo(`колонка ${columns + 1}`)]);
            onChange(["rows"], block.rows.map((row) => [...row, todo("клітинка")]));
          }}
        >
          <span className={styles.addGlyph} aria-hidden="true">+</span> Колонка
        </button>
        <button
          className={styles.addAction}
          type="button"
          disabled={columns === 1}
          onClick={() => {
            if (block.head) onChange(["head"], block.head.slice(0, -1));
            onChange(["rows"], block.rows.map((row) => row.slice(0, -1)));
          }}
        >
          − Остання колонка
        </button>
      </div>
    );
  }

  return null;
}
