"use client";

/**
 * Course map: where the learner is, what the rhythm suggests next.
 *
 * Nothing here is a lock screen. On a soft-gated course (the default) every
 * lesson is reachable from day one and the schedule speaks as a plan — "за
 * планом: день 8" — because a learner has to see week three to prepare for it.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import { courseThemeAttributes, inlineToPlainText } from "@/lms-core";
import { PlatformTrail } from "@/components/platform/PlatformTrail";
import { LEARNING_SHELF_HREF } from "@/lib/platform/content";
import { Icon } from "@/components/Icon";
import { PlatformLoadingState } from "@/components/platform/PlatformLoadingState";
import { ProgressRail } from "@/components/platform/ProgressRail";
import {
  ensureTimeZoneSynced,
  fetchCourse,
  postProgress,
  progressClientId,
  type CourseViewDto,
  type LmsFailure,
} from "./lmsClient";
import { LmsNotice } from "./LmsNotice";
import styles from "./Lms.module.css";
import { useSurfaceHref } from "@/components/platform/layout/SurfaceHost";

type Availability = CourseViewDto["outline"][number]["availability"];

/**
 * What the rhythm says about a lesson the learner has run ahead of.
 *
 * Deliberately phrased as a plan ("за планом"), never as a refusal: the lesson
 * opens either way, and the only thing worth saying is where it belongs.
 */
function scheduleNote(availability: Availability): string | null {
  if (!availability.available || !availability.ahead) return null;
  const ahead = availability.ahead;
  if (ahead.reason === "before_sequence") return "за планом — далі по порядку";
  if (ahead.daysAhead === 1) return "за планом — завтра";
  return `за планом — день ${ahead.scheduledDay}`;
}

/** Only reachable on a hard-gated course, where the schedule really does shut the door. */
function lockNote(availability: Availability): string {
  if (availability.available) return "";
  if (availability.reason === "locked_by_day") {
    return availability.daysRemaining === 1
      ? "відкриється завтра"
      : `відкриється через ${availability.daysRemaining} дн.`;
  }
  return "спершу заверши попередній урок";
}

export function CourseView({
  courseSlug,
  draftPreview = false,
  previewReturnTo,
}: {
  courseSlug: string;
  draftPreview?: boolean;
  previewReturnTo?: string;
}) {
  const href = useSurfaceHref();
  const previewQuery = draftPreview
    ? `?${new URLSearchParams({
        preview: "draft",
        ...(previewReturnTo ? { returnTo: previewReturnTo } : {}),
      }).toString()}`
    : "";
  const [state, setState] = useState<
    { status: "loading" } | { status: "ready"; data: CourseViewDto } | { status: "error"; error: LmsFailure }
  >({ status: "loading" });

  const [restarting, setRestarting] = useState(false);

  const load = useCallback(async () => {
    const result = await fetchCourse(courseSlug, draftPreview);
    setState(result.ok ? { status: "ready", data: result.data } : { status: "error", error: result.error });
  }, [courseSlug, draftPreview]);

  /**
   * Takes a finished course back to step one.
   *
   * One batch of `lesson.uncompleted`, which is exactly why the endpoint is a
   * batch: the server folds progress once up front, so every step is still
   * unlocked when its own event is validated — un-completing step 1 does not
   * lock step 2 out of the same request.
   */
  const restart = useCallback(
    async (entries: CourseViewDto["outline"]) => {
      if (restarting || draftPreview) return;
      const done = entries.filter((entry) => entry.completed && !entry.isReference);
      if (done.length === 0) return;

      setRestarting(true);
      const stamp = String(Date.now());
      const result = await postProgress(
        courseSlug,
        done.map((entry) => ({
          clientId: progressClientId({ lessonId: entry.lessonId, kind: "uncomplete", stamp }),
          type: "lesson.uncompleted" as const,
          lessonSlug: entry.slug,
          occurredAt: new Date().toISOString(),
        }))
      );
      setRestarting(false);

      if (result.ok) void load();
    },
    [courseSlug, restarting, load, draftPreview]
  );

  useEffect(() => {
    // Guarded so a course switch cannot land a stale response.
    let cancelled = false;
    void (async () => {
      // Zone first: day N is computed from it on the very next call.
      await ensureTimeZoneSynced();
      if (cancelled) return;
      const result = await fetchCourse(courseSlug, draftPreview);
      if (cancelled) return;
      setState(result.ok ? { status: "ready", data: result.data } : { status: "error", error: result.error });
    })();
    return () => {
      cancelled = true;
    };
  }, [courseSlug, draftPreview]);

  if (state.status === "loading") {
    return (
      <main className={styles.wrap} data-cw-platform-template="learn-course">
        <PlatformLoadingState label="Бібліотека" title="Завантажуємо курс…" detail="Відновлюємо ваш поступ і наступний урок." />
      </main>
    );
  }

  if (state.status === "error") {
    return (
      <main className={styles.wrap} data-cw-platform-template="learn-course">
        <LmsNotice failure={state.error} onRetry={load} />
      </main>
    );
  }

  const { course, standing, outline, currentLessonSlug } = state.data;

  // Reference material is listed apart from the protocol: it is a handbook you
  // consult, not a step you complete.
  const steps = outline.filter((entry) => !entry.isReference);
  const reference = outline.filter((entry) => entry.isReference);

  return (
    <main
      className={styles.wrap}
      data-cw-platform-template="learn-course"
      // The course's own gamma, scoped to the course. It re-points the semantic
      // role names on this subtree only, so the platform around it is untouched
      // and no component here knows a palette changed (src/lms-core/theme.ts).
      {...courseThemeAttributes(state.data.course.theme ?? undefined)}
    >
      {/* The same crumb the builder draws, from the same component. A learner
          and an author are looking at one hierarchy from two sides; it should
          not be two different controls. Replaced a single «Мої курси» back
          link — which knew one level and said nothing about where you are. */}
      {!draftPreview ? (
        <PlatformTrail steps={[{ label: "Мої курси", href: href(LEARNING_SHELF_HREF) }, { label: course.title }]} />
      ) : null}
      <p className={styles.eyebrow}>Мій курс</p>
      <h1 className={styles.title}>{course.title}</h1>
      {course.summary ? <p className={styles.lead}>{inlineToPlainText(course.summary)}</p> : null}

      <div className={styles.standing}>
        <span className={styles.chip}>
          {standing.completedLessons} з {standing.totalLessons} пройдено
        </span>
        {standing.currentDay !== null ? <span className={styles.chip}>День {standing.currentDay}</span> : null}
        {standing.isFinished ? <span className={styles.chip}>Курс завершено</span> : null}
      </div>

      <ProgressRail
        value={standing.completedLessons}
        total={standing.totalLessons}
        label="Прогрес курсу"
        className={styles.courseProgress}
      />

      {/* A finished protocol is meant to be repeated, so the end of the course
          offers the beginning of it rather than a dead end. */}
      {standing.isFinished && !draftPreview ? (
        <div className={styles.restartRow}>
          <p className={styles.restartHint}>Протокол можна проходити повторно — коли відчуєте потребу.</p>
          <button
            className={styles.restartButton}
            type="button"
            disabled={restarting}
            onClick={() => void restart(outline)}
          >
            {restarting ? "Скидаємо…" : "Пройти заново"}
          </button>
        </div>
      ) : null}

      <ul className={styles.outline}>
        {steps.map((entry) => {
          const lessonHref = href(`/learn/${course.slug}/${entry.slug}${previewQuery}`);
          const badgeLabel = entry.dayIndex ?? "•";
          const isCurrent = entry.slug === currentLessonSlug;

          const meta = [
            entry.durationMin ? `${entry.durationMin} хв` : null,
            scheduleNote(entry.availability),
            isCurrent && !entry.completed ? "продовжити" : null,
          ]
            .filter(Boolean)
            .join(" · ");

          // A hard-gated course still exists in the model; it renders as a row
          // that states its date instead of opening.
          if (!entry.availability.available) {
            return (
              <li key={entry.lessonId} className={styles.outlineItem}>
                <div className={styles.outlineLocked} aria-disabled="true">
                  <span className={styles.dayBadge} aria-hidden="true">
                    {badgeLabel}
                  </span>
                  <div className={styles.outlineBody}>
                    <h2 className={styles.outlineTitle}>{entry.title}</h2>
                    <p className={styles.outlineMeta}>{lockNote(entry.availability)}</p>
                  </div>
                  <Icon name="lock" size={20} className={styles.outlineGlyph} />
                </div>
              </li>
            );
          }

          return (
            <li key={entry.lessonId} className={styles.outlineItem} data-current={isCurrent || undefined}>
              <Link className={styles.outlineLink} href={lessonHref}>
                <span className={entry.completed ? styles.dayBadgeDone : styles.dayBadge} aria-hidden="true">
                  {entry.completed ? <Icon name="check" size={18} /> : badgeLabel}
                </span>
                <div className={styles.outlineBody}>
                  <h2 className={styles.outlineTitle}>{entry.title}</h2>
                  {meta ? <p className={styles.outlineMeta}>{meta}</p> : null}
                </div>
                <Icon name="chevron-right" size={20} className={styles.outlineGlyph} />
              </Link>
            </li>
          );
        })}
      </ul>

      {reference.length > 0 ? (
        <section className={styles.referenceSection}>
          <h2 className={styles.referenceHeading}>Довідкові матеріали</h2>
          <p className={styles.referenceLead}>
            Не входять у проходження — відкривай, коли знадобиться.
          </p>
          <ul className={styles.outline}>
            {reference.map((entry) => (
              <li key={entry.lessonId} className={styles.outlineItem}>
                <Link className={styles.outlineLink} href={href(`/learn/${course.slug}/${entry.slug}${previewQuery}`)}>
                  <span className={styles.dayBadge} aria-hidden="true">
                    <Icon name="star" size={18} />
                  </span>
                  <div className={styles.outlineBody}>
                    <h3 className={styles.outlineTitle}>{entry.title}</h3>
                    {entry.durationMin ? (
                      <p className={styles.outlineMeta}>{entry.durationMin} хв</p>
                    ) : null}
                  </div>
                  <Icon name="chevron-right" size={20} className={styles.outlineGlyph} />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
