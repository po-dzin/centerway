"use client";

/**
 * Lesson player.
 *
 * Optimistic on checklist ticks (the tap must feel instant on a phone), but the
 * server's re-folded state always wins — the API returns authoritative progress
 * with every write, so a rejected event self-corrects rather than drifting.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from "react";
import Link from "next/link";

import { courseThemeAttributes, inlineToPlainText } from "@/lms-core";
import { Icon } from "@/components/Icon";
import { PlatformLoadingState } from "@/components/platform/PlatformLoadingState";
import { useChromeReveal } from "@/components/platform/layout/useChromeReveal";
import { lessonPagerLayout } from "@/lib/lms/lessonNavigation";
import { BlockRenderer } from "./LessonBlocks";
import { CourseContentsDrawer } from "./CourseContentsDrawer";
import { LmsNotice } from "./LmsNotice";
import { ReaderTopButton } from "./ReaderTopButton";
import { ReaderTextSize } from "./ReaderTextSize";
import { ReaderMarkLayer } from "./ReaderMarkLayer";
import { useAnnotations } from "./useAnnotations";
import {
  clearMark,
  MARK_MIN_OFFSET_PX,
  minutesRemaining,
  readMark,
  readScaleId,
  resolveMarkOffset,
  scaleValue,
  serverScaleId,
  subscribeScale,
  writeMark,
  writeScaleId,
} from "./readerSettings";
import {
  ensureTimeZoneSynced,
  fetchLesson,
  postProgress,
  progressClientId,
  type LessonViewDto,
  type LmsFailure,
} from "./lmsClient";
import styles from "./Lms.module.css";
import { useSurfaceHref } from "@/components/platform/layout/SurfaceHost";

type State =
  | { status: "loading" }
  | { status: "ready"; data: LessonViewDto }
  | { status: "error"; error: LmsFailure };

export function LessonView({
  courseSlug,
  lessonSlug,
  draftPreview = false,
  previewReturnTo,
}: {
  courseSlug: string;
  lessonSlug: string;
  draftPreview?: boolean;
  previewReturnTo?: string;
}) {
  const surfaceHref = useSurfaceHref();
  const previewQuery = draftPreview
    ? `?${new URLSearchParams({
        preview: "draft",
        ...(previewReturnTo ? { returnTo: previewReturnTo } : {}),
      }).toString()}`
    : "";
  const [state, setState] = useState<State>({ status: "loading" });
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});
  const [completed, setCompleted] = useState(false);
  const [pending, setPending] = useState(false);
  const [contentsOpen, setContentsOpen] = useState(false);
  /* The floating chrome rides the same reveal the topbar used to — see
     `useChromeReveal` for why direction and not depth. Locked open while the
     contents drawer is up: the drawer is opened FROM this cluster, and a
     cluster that walked off under it would leave the dialog hanging off
     nothing. */
  const chromeRef = useRef<HTMLDivElement | null>(null);
  const { hidden: chromeHidden } = useChromeReveal(true, chromeRef, { locked: contentsOpen });
  const [readingRatio, setReadingRatio] = useState(0);
  const bodyRef = useRef<HTMLDivElement>(null);
  const previousLinkRef = useRef<HTMLAnchorElement>(null);
  const nextLinkRef = useRef<HTMLAnchorElement>(null);
  /* Nothing may be SAVED before the saved position has been restored: the
     browser starts every navigation at the top, and a scroll handler that
     believed that would overwrite the mark with a zero. */
  const restoredRef = useRef(false);
  const lastSaveRef = useRef(0);

  /* A device setting, subscribed to rather than copied into state by an effect:
     the server has no idea what this reader chose, so the markup goes out at the
     design's own size and the stored choice arrives on hydration. */
  const scaleId = useSyncExternalStore(subscribeScale, readScaleId, serverScaleId);
  const chooseScale = useCallback((id: string) => writeScaleId(id), []);

  /* The reader's own marks. Course-wide and fetched once, so walking the pager
     between lessons does not re-ask. A draft preview is an authoring
     perspective — it writes no progress and it writes no marks. */
  const marks = useAnnotations(courseSlug, !draftPreview);
  /* Memoised, and it matters: the mark layer keys its whole repaint cycle off
     the identity of this array. A fresh `filter()` on every render would make
     every render a new repaint, and every repaint a new render. */
  const lessonMarks = useMemo(() => marks.forLesson(lessonSlug), [marks, lessonSlug]);

  const load = useCallback(async () => {
    const result = await fetchLesson(courseSlug, lessonSlug, draftPreview);
    if (!result.ok) {
      setState({ status: "error", error: result.error });
      return;
    }
    setState({ status: "ready", data: result.data });
    setChecklist(result.data.progress.checklist);
    setCompleted(result.data.progress.status === "completed");
  }, [courseSlug, lessonSlug, draftPreview]);

  useEffect(() => {
    // Guarded so a fast navigation between lessons cannot land stale content.
    let cancelled = false;
    void (async () => {
      // Zone first: lesson availability is computed from it on the next call.
      await ensureTimeZoneSynced();
      if (cancelled) return;
      const result = await fetchLesson(courseSlug, lessonSlug, draftPreview);
      if (cancelled) return;
      if (!result.ok) {
        setState({ status: "error", error: result.error });
        return;
      }
      setState({ status: "ready", data: result.data });
      setChecklist(result.data.progress.checklist);
      setCompleted(result.data.progress.status === "completed");
    })();
    return () => {
      cancelled = true;
    };
  }, [courseSlug, lessonSlug, draftPreview]);

  // Reading position for the current lesson, driven by how far the body has
  // scrolled past the viewport — a progress bar for THIS step, distinct from
  // course completion.
  useEffect(() => {
    if (state.status !== "ready") return;

    const save = () => {
      // A draft preview is an authoring perspective, not a read.
      if (draftPreview || !restoredRef.current) return;
      const y = window.scrollY;
      const height = document.documentElement.scrollHeight;
      // Near the top there is nothing to return to, and at the end the lesson
      // is behind the reader — both drop the mark rather than pin them to it.
      if (y < MARK_MIN_OFFSET_PX || y + window.innerHeight >= height - 80) {
        clearMark(courseSlug, lessonSlug);
        return;
      }
      const now = Date.now();
      if (now - lastSaveRef.current < 400) return;
      lastSaveRef.current = now;
      writeMark(courseSlug, lessonSlug, { y, h: height });
    };

    const update = () => {
      const body = bodyRef.current;
      if (!body) return;
      const start = body.offsetTop;
      const scrollable = body.offsetHeight - window.innerHeight;
      if (scrollable <= 0) {
        setReadingRatio(1);
      } else {
        const scrolled = window.scrollY - start;
        setReadingRatio(Math.min(1, Math.max(0, scrolled / scrollable)));
      }
      save();
    };

    // A tab closed or backgrounded mid-scroll is the normal way reading ends,
    // and it never lands inside the throttle window.
    const flush = () => {
      lastSaveRef.current = 0;
      save();
    };

    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", flush);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", flush);
      flush();
    };
  }, [state.status, lessonSlug, courseSlug, draftPreview]);

  /**
   * Back to where the reading stopped.
   *
   * The one function a serious reader owes a long text: a twenty-two block
   * lesson closed in the middle used to reopen at its title, which means the
   * reader pays for the interruption twice. An explicit `#block-…` in the URL
   * wins — that is someone asking for a specific place, not for their own.
   */
  useEffect(() => {
    restoredRef.current = false;
    if (state.status !== "ready" || draftPreview) {
      return;
    }
    if (window.location.hash) {
      restoredRef.current = true;
      return;
    }
    const mark = readMark(courseSlug, lessonSlug);
    if (!mark) {
      restoredRef.current = true;
      return;
    }
    /* NOT ONE JUMP — the page is still growing while we aim at it. A lesson
       renders its blocks, then its images arrive and the document can triple in
       height; a single `scrollTo` right after the first paint lands at the
       bottom of a page that is about to become three times longer, or gets
       clamped to a max scroll that does not exist yet. So the offset is
       re-aimed every frame for a short window, against the height the document
       actually has at that moment, and the first gesture from the reader ends
       it — the moment they scroll themselves, where they are is the answer. */
    let frame = 0;
    const started = Date.now();
    const settle = () => {
      restoredRef.current = true;
      cancelAnimationFrame(frame);
      window.removeEventListener("wheel", settle);
      window.removeEventListener("touchstart", settle);
      window.removeEventListener("keydown", settle);
    };
    const aim = () => {
      const target = resolveMarkOffset(mark, document.documentElement.scrollHeight);
      if (Math.abs(window.scrollY - target) > 4) window.scrollTo({ top: target, behavior: "auto" });
      if (Date.now() - started > 1500) {
        settle();
        return;
      }
      frame = requestAnimationFrame(aim);
    };
    frame = requestAnimationFrame(aim);
    window.addEventListener("wheel", settle, { passive: true });
    window.addEventListener("touchstart", settle, { passive: true });
    window.addEventListener("keydown", settle);
    return settle;
  }, [state.status, courseSlug, lessonSlug, draftPreview]);

  /**
   * ← and → walk the course on a desktop keyboard.
   *
   * They press the pager's own links rather than routing themselves, so the
   * keys can never reach a neighbour the page decided not to offer — a locked
   * next step, or the pager a reference page does not have.
   */
  useEffect(() => {
    if (state.status !== "ready" || contentsOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.isContentEditable ||
          ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) ||
          /* Any button, or anything inside a composite widget or dialog — the
             size menu (`role="menu"`) and the note editor (`role="dialog"`)
             both hold buttons of their own, and this guard only excluded form
             fields. A reader arrowing through text-size options, or pressing
             "Прибрати позначку" with a keyboard, moved the lesson out from
             under them — arrow keys inside a menu should navigate the menu,
             and a stray keystroke in an open note dialog should never be able
             to discard it by leaving the page. */
          target.closest('button, [role="menu"], [role="dialog"], [role="listbox"]'))
      ) {
        return;
      }
      const link = event.key === "ArrowLeft" ? previousLinkRef.current : nextLinkRef.current;
      if (!link) return;
      event.preventDefault();
      link.click();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [state.status, contentsOpen]);

  const lesson = state.status === "ready" ? state.data.lesson : null;

  const checklistSatisfied = useMemo(() => {
    const requiredIds = state.status === "ready" ? state.data.requiredChecklistItemIds : [];
    return requiredIds.every((id) => checklist[id] === true);
  }, [state, checklist]);

  const toggleItem = useCallback(
    async (itemId: string, checked: boolean) => {
      if (!lesson) return;

      // Optimistic: the checkbox must respond to the thumb immediately.
      setChecklist((current) => ({ ...current, [itemId]: checked }));

      // Preview is a read-only authoring perspective. It may simulate an
      // interaction locally, but it must not write learner progress.
      if (draftPreview) return;

      const result = await postProgress(courseSlug, [
        {
          clientId: progressClientId({
            lessonId: lesson.id,
            kind: "check",
            itemId,
            // New event per toggle, so un-ticking is not swallowed as a duplicate.
            stamp: String(Date.now()),
          }),
          type: "checklist.toggled",
          lessonSlug: lesson.slug,
          occurredAt: new Date().toISOString(),
          payload: { itemId, checked },
        },
      ]);

      if (!result.ok) {
        // Server rejected or offline — roll back rather than show a false tick.
        setChecklist((current) => ({ ...current, [itemId]: !checked }));
      }
    },
    [courseSlug, lesson, draftPreview]
  );

  /**
   * Marks the step done, or takes that mark back.
   *
   * Both directions go through the same append-only log. The `stamp` matters:
   * without it the clientId would be stable per lesson, so completing again
   * after un-completing would be swallowed as a duplicate and the checkbox
   * would silently refuse to re-tick.
   */
  const setLessonCompleted = useCallback(
    async (next: boolean) => {
      if (!lesson || pending) return;
      if (draftPreview) {
        setCompleted(next);
        return;
      }
      setPending(true);

      const result = await postProgress(courseSlug, [
        {
          clientId: progressClientId({
            lessonId: lesson.id,
            kind: next ? "complete" : "uncomplete",
            stamp: String(Date.now()),
          }),
          type: next ? "lesson.completed" : "lesson.uncompleted",
          lessonSlug: lesson.slug,
          occurredAt: new Date().toISOString(),
        },
      ]);

      setPending(false);
      if (!result.ok) return;

      if (result.data.rejected.length > 0) {
        // The gate said no (e.g. checklist changed under us) — resync from server.
        void load();
        return;
      }

      setCompleted(next);

      // Refresh so the drawer, the pager and the outline reflect the new state —
      // completing a step can unlock the next one, and un-completing can close it.
      void load();
    },
    [courseSlug, lesson, pending, load, draftPreview]
  );

  if (state.status === "loading") {
    return (
      <main className={styles.wrap} data-cw-platform-template="learn-lesson">
        <PlatformLoadingState label="Бібліотека" title="Завантажуємо урок…" detail="Відновлюємо матеріали і ваш стан проходження." />
      </main>
    );
  }

  if (state.status === "error") {
    return (
      <main className={styles.wrap} data-cw-platform-template="learn-lesson">
        <div className={styles.lessonTopBar}>
          <Link className={styles.backButton} href={surfaceHref(`/learn/${courseSlug}${previewQuery}`)}>
            <Icon name="arrow-left" size={18} />
            <span>До курсу</span>
          </Link>
        </div>
        <LmsNotice failure={state.error} onRetry={load} />
      </main>
    );
  }

  const data = state.data;
  const hasObjective = data.lesson.blocks.some((block) => block.type === "lesson_objective");
  const { nav } = data;
  const pager = lessonPagerLayout({
    isReference: data.isReference,
    hasPrevious: Boolean(nav.previous),
    hasNext: Boolean(nav.next),
  });

  return (
    <>
      <main
        className={styles.wrap}
        data-cw-platform-template="learn-lesson"
        inert={contentsOpen ? true : undefined}
        aria-hidden={contentsOpen ? "true" : undefined}
        // The course's gamma, on the lesson too. Scoped rather than global so a
        // learner walking between two courses with different palettes never sees
        // one course's green on the other's page.
        {...courseThemeAttributes(data.courseTheme ?? undefined)}
        // The reader's size choice, multiplied into the course's own body size
        // by `.blocks`. Scoped here rather than on `:root` so it moves the
        // lesson text and nothing else on the platform.
        style={{ "--cw-reader-scale": scaleValue(scaleId) } as CSSProperties}
      >
      <div className={styles.readingTrack} aria-hidden="true">
        <div className={styles.readingFill} style={{ width: `${Math.round(readingRatio * 100)}%` }} />
      </div>

      {/* THE READER'S CHROME, FLOATING (2026-08-29). There is no topbar on this
          route — see the `reading` note in PlatformLayout. What a lesson needs
          is two answers, and they are two objects on the bar's own material
          rather than three full-width rows above the first line: the way out on
          the left, the reading tools on the right. Both ride the same reveal
          the bar used to (`useChromeReveal`), so scrolling down leaves the
          column with nothing over it and one flick up brings them back.

          It sits inside <main> on purpose: the contents drawer marks the whole
          column `inert`, and these controls belong to the column it is covering.
          Nothing on the way down is `position: relative`, so the fixed layer is
          measured against the viewport as intended. */}
      <div className={styles.readerChrome} ref={chromeRef} data-hidden={chromeHidden ? "true" : undefined}>
        {/* The crumb row this replaces named three levels and only one of them
            was ever pressed. The lesson was the last step and not a link; the
            shelf is one tap on from the course. What is left is the tap that
            was doing the work.

            NO LABEL ON IT (2026-08-29). It carried the course title for one
            revision and that was worse than the row it replaced: a course can
            be called anything, so on a phone the pill was a truncated fragment
            ending in an ellipsis — a name you cannot read, in the widest object
            on the screen, over the first line of the lesson. An arrow pointing
            back needs no caption; the course's name is one tap away, on the
            course. The full label lives in `aria-label`, where a screen reader
            gets it without the layout paying for it. */}
        <Link
          className={styles.readerBack}
          href={surfaceHref(`/learn/${courseSlug}${previewQuery}`)}
          aria-label={`До курсу: ${data.courseTitle}`}
        >
          <Icon name="arrow-left" size={18} />
        </Link>

        <div className={styles.readerTools}>
          {/* A bookmark is about the LESSON, so it sits with the lesson's own
              controls rather than in the text. It is not progress and never
              becomes progress: «пройдено» is a claim about doing the work,
              «закладка» is a note that this page is one to come back to. */}
          {!draftPreview ? (
            <button
              className={`${styles.iconButton} ${styles.bookmarkButton}`}
              type="button"
              data-marked={marks.bookmarked(lessonSlug) ? "true" : undefined}
              aria-pressed={marks.bookmarked(lessonSlug)}
              aria-label={marks.bookmarked(lessonSlug) ? "Прибрати закладку" : "Додати закладку"}
              /* Held until the course's first fetch resolves, same as
                 ReaderMarkLayer below. A press that lands first writes an
                 optimistic bookmark that GET then has no way to know about —
                 the fetch overwrites the whole list wholesale — so the mark
                 saved to the server comes back unmarked until reload. */
              disabled={!marks.ready}
              onClick={() => void marks.toggleBookmark(lessonSlug)}
            >
              {/* Two glyphs, not one glyph and a colour: a set bookmark is
                  solid, an unset one is the outline. The state is in the shape,
                  so it survives a screenshot, a colour-blind reader and the
                  moment the control is not the only thing on screen. */}
              <Icon name={marks.bookmarked(lessonSlug) ? "bookmark-marked" : "bookmark"} size={18} />
            </button>
          ) : null}

          <ReaderTextSize value={scaleId} onChange={chooseScale} />

          {/* The word «Зміст» went with the row. In a cluster of equal targets
              one labelled control sets the width of everything beside it, and
              the list glyph says the same thing at a third of the room. */}
          <button
            className={`${styles.iconButton} ${styles.contentsButton}`}
            type="button"
            onClick={() => setContentsOpen(true)}
            aria-haspopup="dialog"
            aria-label="Зміст курсу"
          >
            <Icon name="menu" size={18} />
          </button>
        </div>
      </div>

      {/* Position in the course sits next to the duration, so "where am I / how
          long is this" is answered in one glance. It is a CAPTION now rather
          than half of a chrome row: it stopped sharing a line with the tools
          when they floated off, so it reads with the title it belongs to and
          scrolls away with it. Reference pages get a label instead of a
          counter — they hold no place in the sequence. */}
      <p className={styles.stepMarker}>
        {nav.position !== null ? (
          <span className={styles.stepCount}>
            {nav.position} / {nav.total}
          </span>
        ) : (
          <span className={styles.referenceTag}>Довідник</span>
        )}
        <span>{data.module.title}</span>
        {/* Total length answers "should I start this now"; once reading has
            started the only useful number is what is left, and the same
            authored duration answers that against the scroll position. */}
        {data.lesson.durationMin ? (
          <>
            <span className={styles.stepDivider} aria-hidden="true">·</span>
            <span>
              {readingRatio > 0.08 && readingRatio < 0.99
                ? `лишилось ~${minutesRemaining(data.lesson.durationMin, readingRatio)} хв`
                : `${data.lesson.durationMin} хв`}
            </span>
          </>
        ) : null}
      </p>

      <h1 className={styles.title}>{data.lesson.title}</h1>
      {/* One abstract under the title, never two. Every lesson carries both a
          `summary` and a `lesson_objective`, and in practice they paraphrase
          each other — "Задача етапу — увійти в процес та підготувати органи"
          against "Увійти в процес і підготувати органи". Stacked, they read as
          a choice the page failed to make. The objective wins: it is the more
          specific and the more actionable of the two, and it is already the
          first block. The summary only renders when a lesson has no objective. */}
      {data.lesson.summary && !hasObjective ? (
        <p className={styles.lead}>{inlineToPlainText(data.lesson.summary)}</p>
      ) : null}

      <div className={styles.blocks} ref={bodyRef}>
        {data.lesson.blocks.map((block) => (
          <div id={`block-${block.id}`} key={block.id}>
            <BlockRenderer
              block={block}
              checklist={checklist}
              onToggleChecklistItem={toggleItem}
              disabled={completed}
              courseSlug={courseSlug}
              referenceTargets={data.referenceTargets}
            />
          </div>
        ))}

        {/* Drawn over the column, never inside it — the block tree stays
            exactly what BlockRenderer produced. */}
        {!draftPreview && marks.ready ? (
          <ReaderMarkLayer
            bodyRef={bodyRef}
            lessonSlug={lessonSlug}
            annotations={lessonMarks}
            onMark={(anchor, note) => marks.mark(lessonSlug, anchor, note)}
            onSetNote={marks.setNote}
            onRemove={marks.remove}
            layoutKey={scaleId}
          />
        ) : null}
      </div>

      {data.isReference ? (
        // A lookup page is never "completed", so it has nothing to stick to the
        // bottom of the screen. Contents stays in the stable top position; the
        // hint remains in flow at its real weight, without a fake sequence.
        <p className={styles.completeHint}>Довідкова сторінка — повертайся сюди будь-коли.</p>
      ) : (
        <>
          <label
            className={completed ? styles.completeToggleDone : styles.completeToggle}
            data-blocked={!completed && !checklistSatisfied ? "" : undefined}
          >
            <input
              type="checkbox"
              className={styles.completeInput}
              checked={completed}
              /* A finished lesson CAN be un-ticked: the protocol is repeatable,
                 and the checklist gate guards claiming the lesson is done, not
                 withdrawing that claim. */
              disabled={pending || (!completed && !checklistSatisfied)}
              onChange={(event) => void setLessonCompleted(event.target.checked)}
            />
            <span className={styles.completeMark} aria-hidden="true">
              <Icon name="check" size={16} />
            </span>
            <span>{completed ? "Урок пройдено" : pending ? "Зберігаємо…" : "Позначити урок пройденим"}</span>
          </label>

          {!completed && !checklistSatisfied ? (
            <p className={styles.completeHint}>Відзначте пункти чек-листа, щоб завершити урок.</p>
          ) : null}
        </>
      )}

      {/* Only real neighbours render. A first or last lesson gets one full-width
          destination; a one-step course and reference material get no pager at
          all. Contents has one stable home above the lesson title and is never
          used as a substitute for a missing neighbour.

          The next cell takes the accent once this lesson is done — momentum
          moves rather than duplicating itself.

          One line per cell: the arrow and the side it sits on already say
          "previous" and "next", so the words that used to say it again are
          gone. The lesson title is the only thing here a reader cannot infer,
          and it now gets the whole cell. Direction still reaches screen readers
          through aria-label. */}
      {pager.mode !== "hidden" ? (
        <nav className={styles.pager} data-layout={pager.mode} aria-label="Навігація по уроках">
          {pager.showPrevious && nav.previous ? (
            <Link
              ref={previousLinkRef}
              className={styles.pagerLink}
              href={surfaceHref(`/learn/${courseSlug}/${nav.previous.slug}${previewQuery}`)}
              aria-label={`Попередній урок: ${nav.previous.title}`}
              title={nav.previous.title}
            >
              <Icon name="arrow-left" size={16} className={styles.pagerArrow} />
              <span className={styles.pagerTitle}>{nav.previous.title}</span>
            </Link>
          ) : null}

          {pager.showNext && nav.next ? (
            <Link
              ref={nextLinkRef}
              className={completed ? styles.pagerLinkNextAccent : styles.pagerLinkNext}
              href={surfaceHref(`/learn/${courseSlug}/${nav.next.slug}${previewQuery}`)}
              aria-label={`Наступний урок: ${nav.next.title}`}
              title={nav.next.title}
            >
              <span className={styles.pagerTitle}>{nav.next.title}</span>
              <Icon name="arrow-right" size={16} className={styles.pagerArrow} />
            </Link>
          ) : null}
        </nav>
      ) : null}

      </main>

      {/* Outside `<main>`, because `main` goes inert while the contents drawer
          is open and a control that stays on screen while it cannot be pressed
          is worse than one that leaves with the page.

          No `clearsCompletion` since 2026-08-28: the completion toggle is the
          last object in the column rather than a bar pinned to the foot of the
          screen, so there is nothing down there to step over. */}
      {!contentsOpen ? <ReaderTopButton /> : null}

      {contentsOpen ? (
        <CourseContentsDrawer
          courseSlug={courseSlug}
          outline={data.outline}
          currentSlug={data.lesson.slug}
          draftPreview={draftPreview}
          previewReturnTo={previewReturnTo}
          onClose={() => setContentsOpen(false)}
        />
      ) : null}
    </>
  );
}
