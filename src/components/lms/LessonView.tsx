"use client";

/**
 * Lesson player.
 *
 * Optimistic on checklist ticks (the tap must feel instant on a phone), but the
 * server's re-folded state always wins — the API returns authoritative progress
 * with every write, so a rejected event self-corrects rather than drifting.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

import { courseThemeAttributes, inlineToPlainText } from "@/lms-core";
import { PlatformTrail } from "@/components/platform/PlatformTrail";
import { Icon } from "@/components/Icon";
import { PlatformLoadingState } from "@/components/platform/PlatformLoadingState";
import { LEARNING_SHELF_HREF } from "@/lib/platform/content";
import { BlockRenderer } from "./LessonBlocks";
import { CourseContentsDrawer } from "./CourseContentsDrawer";
import { LmsNotice } from "./LmsNotice";
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

export function LessonView({ courseSlug, lessonSlug }: { courseSlug: string; lessonSlug: string }) {
  const surfaceHref = useSurfaceHref();
  const [state, setState] = useState<State>({ status: "loading" });
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});
  const [completed, setCompleted] = useState(false);
  const [pending, setPending] = useState(false);
  const [contentsOpen, setContentsOpen] = useState(false);
  const [readingRatio, setReadingRatio] = useState(0);
  const bodyRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const result = await fetchLesson(courseSlug, lessonSlug);
    if (!result.ok) {
      setState({ status: "error", error: result.error });
      return;
    }
    setState({ status: "ready", data: result.data });
    setChecklist(result.data.progress.checklist);
    setCompleted(result.data.progress.status === "completed");
  }, [courseSlug, lessonSlug]);

  useEffect(() => {
    // Guarded so a fast navigation between lessons cannot land stale content.
    let cancelled = false;
    void (async () => {
      // Zone first: lesson availability is computed from it on the next call.
      await ensureTimeZoneSynced();
      if (cancelled) return;
      const result = await fetchLesson(courseSlug, lessonSlug);
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
  }, [courseSlug, lessonSlug]);

  // Reading position for the current lesson, driven by how far the body has
  // scrolled past the viewport — a progress bar for THIS step, distinct from
  // course completion.
  useEffect(() => {
    if (state.status !== "ready") return;

    const update = () => {
      const body = bodyRef.current;
      if (!body) return;
      const start = body.offsetTop;
      const scrollable = body.offsetHeight - window.innerHeight;
      if (scrollable <= 0) {
        setReadingRatio(1);
        return;
      }
      const scrolled = window.scrollY - start;
      setReadingRatio(Math.min(1, Math.max(0, scrolled / scrollable)));
    };

    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [state.status, lessonSlug]);

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
    [courseSlug, lesson]
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
    [courseSlug, lesson, pending, load]
  );

  if (state.status === "loading") {
    return (
      <main className={styles.wrap} data-cw-platform-template="learn-lesson">
        <PlatformLoadingState label="Навчання" title="Завантажуємо урок…" detail="Відновлюємо матеріали і ваш стан проходження." />
      </main>
    );
  }

  if (state.status === "error") {
    return (
      <main className={styles.wrap} data-cw-platform-template="learn-lesson">
        <div className={styles.lessonTopBar}>
          <Link className={styles.backButton} href={surfaceHref(`/learn/${courseSlug}`)}>
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

  return (
    <main
      className={styles.wrap}
      data-cw-platform-template="learn-lesson"
      // The course's gamma, on the lesson too. Scoped rather than global so a
      // learner walking between two courses with different palettes never sees
      // one course's green on the other's page.
      {...courseThemeAttributes(data.courseTheme ?? undefined)}
    >
      <div className={styles.readingTrack} aria-hidden="true">
        <div className={styles.readingFill} style={{ width: `${Math.round(readingRatio * 100)}%` }} />
      </div>

      <div className={styles.lessonTopBar}>
        {/* Three levels where there used to be one «До курсу». The lesson is
            the last step and is not a link — the crumb a learner can press has
            to be the one that looks pressable. */}
        <PlatformTrail
          steps={[
            { label: "Мої курси", href: surfaceHref(LEARNING_SHELF_HREF) },
            { label: data.courseTitle, href: surfaceHref(`/learn/${courseSlug}`) },
            { label: data.lesson.title },
          ]}
        />
        <span className={styles.topBarSpacer} />
        <button
          className={styles.iconButton}
          type="button"
          onClick={() => setContentsOpen(true)}
          aria-haspopup="dialog"
        >
          <Icon name="menu" size={18} />
          <span>Зміст</span>
        </button>
      </div>

      {/* Position in the course sits next to the duration, so "where am I / how
          long is this" is answered in one glance. Reference pages get a label
          instead of a counter — they hold no place in the sequence. */}
      <p className={styles.stepMarker}>
        {nav.position !== null ? (
          <span className={styles.stepCount}>
            {nav.position} / {nav.total}
          </span>
        ) : (
          <span className={styles.referenceTag}>Довідник</span>
        )}
        <span>{data.module.title}</span>
        {data.lesson.durationMin ? (
          <>
            <span className={styles.stepDivider} aria-hidden="true">·</span>
            <span>{data.lesson.durationMin} хв</span>
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
          <BlockRenderer
            key={block.id}
            block={block}
            checklist={checklist}
            onToggleChecklistItem={toggleItem}
            disabled={completed}
          />
        ))}
      </div>

      {/* One control in the bar, and only one. Advancing lives in the pager
          below, with the next lesson's real title — two competing buttons in a
          sticky strip is how the reader loses the thing they came for. */}
      {data.isReference ? (
        // A lookup page is never "completed", so it has nothing to stick to the
        // bottom of the screen. It used to float a card holding a hint and a
        // second "До курсу" — over a pager that already offers the course map
        // one scroll below. The hint stays, in the flow, at its real weight.
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

      {/* Always reachable, whether or not the lesson is finished: re-reading a
          previous lesson must never require going back to the course page. The
          next cell takes the accent once this one is done — the momentum moves
          rather than duplicating itself.

          One line per cell: the arrow and the side it sits on already say
          "previous" and "next", so the words that used to say it again are
          gone. The lesson title is the only thing here a reader cannot infer,
          and it now gets the whole cell. Direction still reaches screen readers
          through aria-label. */}
      <nav className={styles.pager} aria-label="Навігація по уроках">
        {nav.previous ? (
          <Link
            className={styles.pagerLink}
            href={surfaceHref(`/learn/${courseSlug}/${nav.previous.slug}`)}
            aria-label={`Попередній урок: ${nav.previous.title}`}
            title={nav.previous.title}
          >
            <Icon name="arrow-left" size={16} className={styles.pagerArrow} />
            <span className={styles.pagerTitle}>{nav.previous.title}</span>
          </Link>
        ) : (
          <Link className={styles.pagerLink} href={surfaceHref(`/learn/${courseSlug}`)}>
            <Icon name="arrow-left" size={16} className={styles.pagerArrow} />
            <span className={styles.pagerTitle}>Зміст</span>
          </Link>
        )}

        {nav.next ? (
          <Link
            className={completed ? styles.pagerLinkNextAccent : styles.pagerLinkNext}
            href={surfaceHref(`/learn/${courseSlug}/${nav.next.slug}`)}
            aria-label={`Наступний урок: ${nav.next.title}`}
            title={nav.next.title}
          >
            <span className={styles.pagerTitle}>{nav.next.title}</span>
            <Icon name="arrow-right" size={16} className={styles.pagerArrow} />
          </Link>
        ) : (
          <Link className={styles.pagerLinkNext} href={surfaceHref(`/learn/${courseSlug}`)}>
            <span className={styles.pagerTitle}>Зміст</span>
            <Icon name="arrow-right" size={16} className={styles.pagerArrow} />
          </Link>
        )}
      </nav>

      {contentsOpen ? (
        <CourseContentsDrawer
          courseSlug={courseSlug}
          outline={data.outline}
          currentSlug={data.lesson.slug}
          onClose={() => setContentsOpen(false)}
        />
      ) : null}
    </main>
  );
}
