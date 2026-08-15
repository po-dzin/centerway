"use client";

/**
 * Lesson player.
 *
 * Optimistic on checklist ticks (the tap must feel instant on a phone), but the
 * server's re-folded state always wins — the API returns authoritative progress
 * with every write, so a rejected event self-corrects rather than drifting.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { inlineToPlainText } from "@/lms-core";
import { BlockRenderer } from "./LessonBlocks";
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
  const [nextLessonSlug, setNextLessonSlug] = useState<string | null>(null);

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

  const completeLesson = useCallback(async () => {
    if (!lesson || pending) return;
    setPending(true);

    const result = await postProgress(courseSlug, [
      {
        clientId: progressClientId({ lessonId: lesson.id, kind: "complete" }),
        type: "lesson.completed",
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

    setCompleted(true);

    const index = result.data.outline.findIndex((entry) => entry.slug === lesson.slug);
    const next = index >= 0 ? result.data.outline[index + 1] : undefined;
    setNextLessonSlug(next && next.availability.available ? next.slug : null);
  }, [courseSlug, lesson, pending, load]);

  if (state.status === "loading") {
    return (
      <div className={styles.wrap}>
        <p className={styles.lead}>Завантажуємо урок…</p>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className={styles.wrap}>
        <LmsNotice failure={state.error} onRetry={load} />
        <p>
          <Link className={styles.backLink} href={`/learn/${courseSlug}`}>
            ← До курсу
          </Link>
        </p>
      </div>
    );
  }

  const data = state.data;

  return (
    <div className={styles.wrap}>
      <Link className={styles.backLink} href={`/learn/${courseSlug}`}>
        ← До курсу
      </Link>

      <p className={styles.eyebrow}>
        {data.lesson.dayIndex ? `День ${data.lesson.dayIndex}` : data.module.title}
        {data.lesson.durationMin ? ` · ${data.lesson.durationMin} хв` : ""}
      </p>
      <h1 className={styles.title}>{data.lesson.title}</h1>
      {data.lesson.summary ? <p className={styles.lead}>{inlineToPlainText(data.lesson.summary)}</p> : null}

      <div className={styles.blocks}>
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

      <div className={styles.completionBar}>
        {completed ? (
          <>
            <p className={styles.completedState}>✓ Крок пройдено</p>
            {nextLessonSlug ? (
              <Link className={styles.nextLink} href={`/learn/${courseSlug}/${nextLessonSlug}`}>
                Наступний крок
              </Link>
            ) : (
              <Link className={styles.ctaLink} href={`/learn/${courseSlug}`}>
                До курсу
              </Link>
            )}
          </>
        ) : (
          <>
            <p className={styles.completeHint}>
              {checklistSatisfied
                ? "Познач крок як пройдений, коли завершиш."
                : "Відзнач пункти чек-листа, щоб завершити крок."}
            </p>
            <button
              className={styles.completeButton}
              type="button"
              onClick={completeLesson}
              disabled={!checklistSatisfied || pending}
            >
              {pending ? "Зберігаємо…" : "Крок пройдено"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
