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

import { inlineToPlainText } from "@/lms-core";
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

type State =
  | { status: "loading" }
  | { status: "ready"; data: LessonViewDto }
  | { status: "error"; error: LmsFailure };

export function LessonView({ courseSlug, lessonSlug }: { courseSlug: string; lessonSlug: string }) {
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
        <p className={styles.lead}>Завантажуємо урок…</p>
      </main>
    );
  }

  if (state.status === "error") {
    return (
      <main className={styles.wrap} data-cw-platform-template="learn-lesson">
        <div className={styles.lessonTopBar}>
          <Link className={styles.backButton} href={`/learn/${courseSlug}`}>
            <span aria-hidden="true">←</span> До курсу
          </Link>
        </div>
        <LmsNotice failure={state.error} onRetry={load} />
      </main>
    );
  }

  const data = state.data;
  const { nav } = data;

  return (
    <main className={styles.wrap} data-cw-platform-template="learn-lesson">
      <div className={styles.readingTrack} aria-hidden="true">
        <div className={styles.readingFill} style={{ width: `${Math.round(readingRatio * 100)}%` }} />
      </div>

      <div className={styles.lessonTopBar}>
        <Link className={styles.backButton} href={`/learn/${courseSlug}`}>
          <span aria-hidden="true">←</span> До курсу
        </Link>
        <span className={styles.topBarSpacer} />
        <button
          className={styles.iconButton}
          type="button"
          onClick={() => setContentsOpen(true)}
          aria-haspopup="dialog"
        >
          <span aria-hidden="true">☰</span> Зміст
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
      {data.lesson.summary ? <p className={styles.lead}>{inlineToPlainText(data.lesson.summary)}</p> : null}

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

      {data.isReference ? (
        // A lookup page is never "completed" — the only action is going back.
        <div className={styles.completionBar}>
          <p className={styles.completeHint}>Довідкова сторінка — повертайся сюди будь-коли.</p>
          <Link className={styles.nextLinkQuiet} href={`/learn/${courseSlug}`}>
            <span>До курсу</span>
            <span className={styles.nextArrow} aria-hidden="true">→</span>
          </Link>
        </div>
      ) : (
      <div className={styles.completionBar}>
        <label
          className={
            completed
              ? styles.completeToggleDone
              : checklistSatisfied
                ? styles.completeToggle
                : styles.completeToggleDisabled
          }
        >
          <input
            type="checkbox"
            checked={completed}
            /* A finished step CAN be un-ticked: the protocol is repeatable, and
               the checklist gate guards claiming the step is done, not
               withdrawing that claim — hence `completed ||` on the gate. */
            disabled={pending || (!completed && !checklistSatisfied)}
            onChange={(event) => void setLessonCompleted(event.target.checked)}
          />
          <span>{completed ? "Крок пройдено" : pending ? "Зберігаємо…" : "Позначити крок пройденим"}</span>
        </label>

        {completed ? (
          nav.next?.available ? (
            <Link className={styles.nextLink} href={`/learn/${courseSlug}/${nav.next.slug}`}>
              <span>Наступний крок</span>
              <span className={styles.nextArrow} aria-hidden="true">→</span>
            </Link>
          ) : (
            <Link className={styles.nextLinkQuiet} href={`/learn/${courseSlug}`}>
              <span>До курсу</span>
              <span className={styles.nextArrow} aria-hidden="true">→</span>
            </Link>
          )
        ) : (
          <p className={styles.completeHint}>
            {checklistSatisfied
              ? "Познач крок, коли завершиш — і йди далі."
              : "Відзнач пункти чек-листа, щоб завершити крок."}
          </p>
        )}
      </div>
      )}

      {/* Always reachable, whether or not the step is finished: re-reading a
          previous lesson must never require going back to the course page. */}
      {data.isReference ? null : (
      <nav className={styles.pager} aria-label="Навігація по уроках">
        {nav.previous?.available ? (
          <Link className={styles.pagerLink} href={`/learn/${courseSlug}/${nav.previous.slug}`}>
            <span className={styles.pagerLabel}>← Попередній</span>
            <span className={styles.pagerTitle}>{nav.previous.title}</span>
          </Link>
        ) : (
          <span className={styles.pagerEmpty} aria-hidden="true" />
        )}

        {nav.next?.available ? (
          <Link className={styles.pagerLinkNext} href={`/learn/${courseSlug}/${nav.next.slug}`}>
            <span className={styles.pagerLabel}>Наступний →</span>
            <span className={styles.pagerTitle}>{nav.next.title}</span>
          </Link>
        ) : (
          <span className={styles.pagerEmpty} aria-hidden="true" />
        )}
      </nav>
      )}

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
