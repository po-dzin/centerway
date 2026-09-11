"use client";

import { useToast } from "@/components/ToastProvider";
import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import {
  courseThemeAttributes,
  courseReadiness,
  buildInternalReferenceTargets,
  moveItem,
  newLesson,
  newModule,
  PLACEHOLDER_MARKER,
  courseForSave,
  renumber,
  renumberSteps,
  uniqueSlug,
  type Course,
  type CourseModule,
  type Lesson,
  type LessonBlock,
  type LessonBlockType,
  type RichTextNode,
} from "@/lms-core";
import { BuilderFailureNotice, BuilderNotice, BuilderShell } from "./BuilderShell";
import { BuilderVersionHistory } from "./BuilderVersionHistory";
import { BuilderContents } from "./BuilderContents";
import type { MenuItem } from "./BuilderMenu";
import { BuilderInlineEditor, type SlashCommand } from "./BuilderInlineEditor";
import { BuilderEditableTitle } from "./BuilderEditableTitle";
import { importLessonFiles, loadCourse, saveCourse, type BuilderFailure } from "./builderClient";
import { BuilderHistory } from "./BuilderHistory";
import { BuilderToolRail, BuilderToolsOrgan, type BuilderToolMode } from "./BuilderToolRail";
import { useCourseAutosave } from "./useCourseAutosave";
import { rememberZenPreviewReturn, zenPreviewHref } from "@/components/lms/ZenPreviewShell";
import { useCourseHistory } from "./useCourseHistory";
import { useRowDrag } from "./useRowDrag";
import {
  BLOCK_TYPE_HINTS,
  BLOCK_TYPE_LABELS,
  BLOCK_TYPE_ORDER,
  BLOCK_STRUCTURE_ORDER,
  readPath,
  writePath,
} from "./blockFields";
import styles from "./Builder.module.css";
import { PlatformLoadingState } from "@/components/platform/PlatformLoadingState";
import { usePlatformSession } from "@/components/platform/layout/usePlatformSession";
import { lessonDocumentFailureCopy } from "./lessonDocumentCopy";
import { clearDurableCourseDraft, inspectDurableCourseDraft, type DurableCourseDraft } from "./courseDraftStore";
import { BuilderDraftRecovery } from "./BuilderDraftRecovery";
import { BuilderExitPrompt } from "./BuilderExitPrompt";
import { useBuilderExit } from "./useBuilderExit";
import { newBlockRecipe } from "@/lms-core/composition";
import { BlockEditor, internalReferenceOptions } from "./LessonBlockEditor";
import { BlockInsert } from "./LessonBlockInsert";
import { LessonToolContent } from "./LessonToolContent";
import { BLOCK_MOVE_MIME, BUILDER_BLOCK_MIME } from "./lessonDragMime";

type State =
  { status: "loading" } | { status: "failed"; failure: BuilderFailure; detail?: string } | { status: "ready" };

export const ids = () => crypto.randomUUID();

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
  const [state, setState] = useState<State>({ status: "loading" });
  const history = useCourseHistory();
  const { course, dirty } = history;
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const [contentsOpen, setContentsOpen] = useState(false);
  const [versionHistoryOpen, setVersionHistoryOpen] = useState(false);
  const [structureCollapsed, setStructureCollapsed] = useState(false);
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
  /* Same question as on the course page, asked by the same dialogue: a draft
     this device kept from a session that ended without a save. */
  const [draftDecision, setDraftDecision] = useState<{
    kind: "recover" | "conflict";
    draft: DurableCourseDraft;
  } | null>(null);
  const importPicker = useRef<HTMLInputElement>(null);
  const docRef = useRef<HTMLDivElement>(null);
  const draftGeneration = useRef<number | null>(null);
  const serverCourse = useRef<Course | null>(null);
  /** The block just created, so the caret can land in it instead of being aimed. */
  const [freshBlockId, setFreshBlockId] = useState<string | null>(null);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [insertPosition, setInsertPosition] = useState(0);
  const [toolMode, setToolMode] = useState<BuilderToolMode>("blocks");
  /* OPEN ON A DESK, CLOSED ON A PHONE (2026-08-28).

     The tool rail is a column BESIDE the document from 901px up, so having it
     open on arrival is the right greeting: the blocks are simply there. Below
     that width it is a sheet, and the same `true` made every lesson open with
     two thirds of the screen covered — the title and the first paragraph of the
     thing the author came to edit were behind the palette, and the first
     gesture on every lesson was to dismiss it.

     Set in an effect rather than from `matchMedia` in the initialiser, because
     the initialiser runs on the server too: a value that differs between the
     server's render and the client's first one is a hydration mismatch, and
     React does not patch attributes up afterwards. */
  const [toolOpen, setToolOpen] = useState(true);

  useEffect(() => {
    if (window.matchMedia("(max-width: 900px)").matches) setToolOpen(false);
  }, []);
  const [blockSearch, setBlockSearch] = useState("");
  /* See the twin note on the course page: the device-local draft carries the
     account it belongs to, or it is nobody's and is not offered. */
  const ownerId = usePlatformSession()?.user?.id ?? null;

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
        const durable = await inspectDurableCourseDraft(result.data.course, result.data.draftGeneration, ownerId);
        if (cancelled) return;
        // The server version stands until the author answers the dialogue.
        history.reset(result.data.course);
        setDraftDecision(durable.kind === "none" ? null : { kind: durable.kind, draft: durable.draft });
      }
      setState(result.ok ? { status: "ready" } : { status: "failed", failure: result.failure, detail: result.detail });
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
    },
    [history, located],
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
        writePath(current, path, renumberSteps(next(readPath(current, path) as LessonBlock[]))),
      );
    },
    [history, located],
  );

  const insertBlock = useCallback(
    (position: number, type: LessonBlockType) => {
      // A text block starts empty, with the caret ready. Empty prose is pruned
      // before save, so opening a gap and changing one's mind is harmless.
      const block =
        type === "rich_text"
          ? { id: ids(), type, content: [{ kind: "p" as const, text: "" }] }
          : newBlockRecipe(type, ids);
      setFreshBlockId(block.id);
      setSelectedBlockId(block.id);
      if (type !== "rich_text") {
        setToolMode("block");
        setToolOpen(true);
      }
      editBlocks((blocks) => [...blocks.slice(0, position), block, ...blocks.slice(position)]);
    },
    [editBlocks],
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
    { mime: BLOCK_MOVE_MIME, dropTargets: false, portraitClass: styles.dragPortrait },
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

  const persistCourse = useCallback(
    async (snapshot: Course) => {
      if (draftGeneration.current === null) {
        return { ok: false as const, message: "Курс ще завантажується. Спробуйте за мить." };
      }
      const result = await saveCourse(slug, courseForSave(snapshot), draftGeneration.current);
      if (!result.ok) {
        if (result.failure === "conflict") {
          return {
            ok: false as const,
            message: "Цей курс уже змінили в іншій вкладці. Перезавантажте сторінку, щоб не втратити чужі зміни.",
          };
        }
        return { ok: false as const, message: result.detail ?? "Не вдалося зберегти. Спробуйте ще раз." };
      }
      draftGeneration.current = result.data.draftGeneration;
      return {
        ok: true as const,
        generation: result.data.draftGeneration,
        message:
          result.data.blockers.length === 0
            ? "Збережено. Блокерів немає."
            : `Збережено. Лишилось блокерів: ${result.data.blockers.length}.`,
      };
    },
    [slug],
  );

  /* One of the two hooks has to reach the other through a ref — see the same
     pair on the course page. The exit question gates autosave; answering it
     asks for a save, and nothing can be pressed before the first commit. */
  const saveRef = useRef<() => Promise<boolean>>(() => Promise.resolve(false));
  const exit = useBuilderExit({
    slug,
    courseId: course?.id ?? null,
    dirty,
    save: useCallback(() => saveRef.current(), []),
  });
  const { pendingHref } = exit;

  const autosave = useCourseAutosave({
    course,
    dirty,
    ownerId,
    paused: busy || exit.prompt !== null,
    suspended: draftDecision !== null,
    persist: persistCourse,
    markSaved: history.markSaved,
    getDraftGeneration: () => draftGeneration.current,
  });
  const working = busy || autosave.saving;
  const save = autosave.saveNow;

  useEffect(() => {
    saveRef.current = save;
  }, [save]);

  const importIntoLesson = useCallback(
    async (file: File) => {
      if (!located || working) return;
      setBusy(true);
      const result = await importLessonFiles(slug, [file]);
      setBusy(false);
      if (!result.ok || !result.data.lessons[0]) {
        toast.error(
          lessonDocumentFailureCopy(result.ok ? undefined : result.detail, "Не вдалося імпортувати документ в урок."),
        );
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
      toast.success(`Імпортовано «${file.name}». Перевірте урок і збережіть зміни.`);
    },
    [history, located, slug, working, toast],
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
    },
    [history],
  );

  /* Leaving the course asks; anything still inside it saves and goes. The lead
     is `useBuilderExit`; this wrapper only closes the outline drawer, which
     must happen either way — including when the author decides to stay. */
  const navigate = useCallback(
    (href: string) => {
      setContentsOpen(false);
      exit.route(href);
    },
    [exit],
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
    [slug],
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
    [activeSlug, lessonSlugIn, navigate],
  );

  // Arriving by route — a deep link, or a return from preview — seeds the
  // state; back and forward move it again.
  useEffect(() => {
    setActiveSlug(lessonSlug);
  }, [lessonSlug]);

  /**
   * Arriving with a block named in the hash — the arrow in the release panel.
   *
   * The id is resolved against the lesson on screen rather than trusted: the
   * link may be minutes old and the block may be gone, and selecting a block
   * that does not exist leaves the tool rail describing nothing. Runs after the
   * course is loaded, because until then there are no blocks to match.
   */
  useEffect(() => {
    if (state.status !== "ready") return;
    const id = window.location.hash.startsWith("#block-") ? window.location.hash.slice(7) : null;
    if (!id) return;
    const target = document.getElementById(`block-${id}`);
    if (!target) return;
    setSelectedBlockId(id);
    target.scrollIntoView({ block: "center", behavior: "auto" });
  }, [state.status, activeSlug]);

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

  const recoverDraft = () => {
    if (!draftDecision || !serverCourse.current) return;
    history.recover(serverCourse.current, draftDecision.draft.course);
    setDraftDecision(null);
    toast.success("Локальну копію відновлено. Вона збережеться як поточна версія.");
  };

  const discardDraft = () => {
    if (!draftDecision) return;
    void clearDurableCourseDraft(draftDecision.draft.courseId).catch(() => undefined);
    setDraftDecision(null);
    toast.success("Залишено актуальну серверну версію.");
  };

  const trail = [
    { label: "Курси", href: "/build" },
    { label: slug, href: `/build/${slug}` },
  ];

  if (state.status === "loading") {
    return (
      <BuilderShell trail={trail}>
        <PlatformLoadingState
          label="Майстерня"
          title="Завантажуємо урок…"
          detail="Відновлюємо блоки уроку і останню збережену версію."
        />
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

  /* The author's walk through the course — every lesson in stored order,
     reference modules included — used to be computed here for one thing only:
     «2/7» beside the outline glyph. The count left the chrome on 2026-09-06
     (see `.contentsCount` in Builder.module.css) and the walk left with it; the
     outline itself is what answers «where am I», and it answers with the
     lesson's name rather than with its index. */
  const selectedBlockIndex = lesson.blocks.findIndex((block) => block.id === selectedBlockId);
  const selectedBlock = selectedBlockIndex >= 0 ? lesson.blocks[selectedBlockIndex] : null;
  const readiness = courseReadiness(course);
  const referenceTargets = buildInternalReferenceTargets(course);
  const referenceOptions = internalReferenceOptions(referenceTargets, lesson.id, holder.id);

  const addLessonToModule = (moduleId: string) => {
    history.edit(null, (current) => {
      const taken = current.modules.flatMap((entry) => entry.lessons.map((item) => item.slug));
      const nextDay =
        Math.max(0, ...current.modules.flatMap((entry) => entry.lessons.map((item) => item.dayIndex ?? 0))) + 1;
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
      const nextDay =
        Math.max(0, ...current.modules.flatMap((entry) => entry.lessons.map((item) => item.dayIndex ?? 0))) + 1;
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
          editing={{ onModules: editModules, onNote: toast.warning, onLeaveCurrent: setLeaveFor }}
        />
      }
      asideOpen={contentsOpen}
      onAsideClose={() => setContentsOpen(false)}
      asideCollapsed={structureCollapsed}
      onAsideToggle={() => setStructureCollapsed((collapsed) => !collapsed)}
      pageMode="document"
      onNavigate={go}
      toolLayer={
        <BuilderToolRail mode={toolMode} open={toolOpen} onMode={selectTool} onClose={() => setToolOpen(false)}>
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
      /* THE DOCUMENT'S TWO OBJECTS, in the phone's capsule and in the desktop
         topbar — see `organs` in BuilderShell. «Переглянути» and «Зміст» are
         things you press; «Збережено», the blocker count and the lesson's
         position are things you read, and they stay below in `tools`. */
      organs={
        <>
          <button
            className={styles.workspacePreviewAction}
            type="button"
            onClick={preview}
            disabled={working}
            aria-label="Переглянути урок як учень"
            title={dirty ? "Зберегти й відкрити урок як учень" : "Відкрити урок як учень"}
          >
            <Icon name="eye" size={20} />
            <span className={styles.workspaceActionLabel}>Переглянути</span>
          </button>
          {/* THE BLOCK TOOLS, IN THE SAME CAPSULE (2026-09-06). They used to be
              a floating strip at the bottom-right corner of the lesson — a
              second toolbar for one document, at the opposite corner from this
              one, sitting exactly where the thumb rests while typing. On the
              wide screen they stay on their panel's edge, where the panel is.
              */}
          <BuilderToolsOrgan open={toolOpen} mode={toolMode} onOpen={selectTool} onClose={() => setToolOpen(false)} />
          {/* ИСТОРИЯ ЭТОГО УРОКА — та же панель, что на уровне курса, суженная
              до одного урока. Не вторая история: снимок остаётся курсовым,
              отдельной таблицы версий урока нет. Часы стоят и здесь, потому что
              вопрос «что происходило с этим уроком» задают, глядя на урок, а не
              на список курсов. */}
          <button
            className={styles.menuTrigger}
            type="button"
            aria-label="Історія цього уроку"
            title="Історія цього уроку"
            aria-expanded={versionHistoryOpen}
            onClick={() => setVersionHistoryOpen(true)}
          >
            <Icon name="clock" size={18} />
          </button>
          {/* Hidden from 1660px up, where the rail is simply there. A control
              that toggles something already visible is a control that does
              nothing the first time it is pressed. */}
          <button
            className={styles.contentsAction}
            type="button"
            aria-expanded={contentsOpen}
            aria-label="Зміст курсу"
            onClick={() => setContentsOpen((open) => !open)}
          >
            <Icon name="menu" size={18} />
          </button>
        </>
      }
      tools={
        <>
          <span className={styles.workspaceSaveStatus} role="status" aria-live="polite">
            <Icon name="check" size={18} /> {autosave.saving ? "Зберігаємо…" : dirty ? "Є зміни" : "Збережено"}
          </span>
          <button
            className={styles.workspaceBlockers}
            type="button"
            onClick={() => navigate(`/build/${slug}#course-release`)}
          >
            <span aria-hidden="true">•</span> {readiness.blockers.length} блокери
          </button>
        </>
      }
    >
      <BuilderDraftRecovery
        open={draftDecision !== null}
        variant={draftDecision?.kind ?? "recover"}
        savedAt={draftDecision?.draft.updatedAt ?? 0}
        onRecover={recoverDraft}
        onDiscard={discardDraft}
      />
      <BuilderExitPrompt
        open={exit.prompt !== null}
        saving={Boolean(exit.prompt?.saving)}
        failure={exit.prompt?.refused ? autosave.failureMessage : null}
        onSave={exit.saveAndLeave}
        onLeave={exit.leaveWithoutSaving}
        onStay={exit.stay}
      />
      <BuilderVersionHistory
        slug={slug}
        lessonId={lesson.id}
        lessonTitle={lesson.title}
        open={versionHistoryOpen}
        checkpointDisabled={working || dirty}
        onClose={() => setVersionHistoryOpen(false)}
        onRestored={() => {
          setVersionHistoryOpen(false);
          window.location.reload();
        }}
      />
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
            <BlockInsert
              position={index + 1}
              drop={dropGap === index + 1}
              onActivate={activateInsert}
              onAdd={insertBlock}
            />
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
              {autosave.message ?? (dirty ? "Зміни збережуться автоматично" : "Усі зміни збережено")}
            </span>
            <button
              className={styles.commitAction}
              type="button"
              onClick={() => void save()}
              disabled={working || !dirty}
            >
              {autosave.saving ? "Зберігаємо…" : "Зберегти"}
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

export const NODE_LABELS: Record<RichTextNode["kind"], string> = {
  p: "Абзац",
  h3: "Підзаголовок",
  ul: "Список",
  ol: "Нумерований список",
};

/* One glyph per kind, and `list`/`list-ordered` are deliberately the SAME two
   the floating bar draws for `ul`/`ol` — the bar and the menu run the same
   command, so they cannot look like two different offers. */

export const NODE_ICONS: Record<RichTextNode["kind"], MenuItem["icon"]> = {
  p: "paragraph",
  h3: "heading",
  ul: "list",
  ol: "list-ordered",
};

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
export const BLOCK_COMMANDS: SlashCommand[] = BLOCK_STRUCTURE_ORDER.map((type) => ({
  id: `block:${type}`,
  label: BLOCK_TYPE_LABELS[type],
  hint: BLOCK_TYPE_HINTS[type],
  group: "Блоки",
}));

export const NODE_COMMANDS: SlashCommand[] = [
  { id: "p", label: "Абзац", hint: "Звичайний текст.", group: "Текст" },
  { id: "h3", label: "Підзаголовок", hint: "Ділить урок на частини.", group: "Текст" },
  { id: "ul", label: "Список", hint: "Перелік, у якому порядок не важить.", group: "Текст" },
  { id: "ol", label: "Нумерований список", hint: "Кроки, які йдуть по черзі.", group: "Текст" },
];
