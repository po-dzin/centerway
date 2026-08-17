"use client";

/**
 * Course map: where the learner is, what is open, what unlocks when.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import { inlineToPlainText } from "@/lms-core";
import { ensureTimeZoneSynced, fetchCourse, type CourseViewDto, type LmsFailure } from "./lmsClient";
import { LmsNotice } from "./LmsNotice";
import styles from "./Lms.module.css";

export function CourseView({ courseSlug }: { courseSlug: string }) {
  const [state, setState] = useState<
    { status: "loading" } | { status: "ready"; data: CourseViewDto } | { status: "error"; error: LmsFailure }
  >({ status: "loading" });

  const load = useCallback(async () => {
    const result = await fetchCourse(courseSlug);
    setState(result.ok ? { status: "ready", data: result.data } : { status: "error", error: result.error });
  }, [courseSlug]);

  useEffect(() => {
    // Guarded so a course switch cannot land a stale response.
    let cancelled = false;
    void (async () => {
      // Zone first: day N is computed from it on the very next call.
      await ensureTimeZoneSynced();
      if (cancelled) return;
      const result = await fetchCourse(courseSlug);
      if (cancelled) return;
      setState(result.ok ? { status: "ready", data: result.data } : { status: "error", error: result.error });
    })();
    return () => {
      cancelled = true;
    };
  }, [courseSlug]);

  if (state.status === "loading") {
    return (
      <main className={styles.wrap} data-cw-platform-template="learn-course">
        <p className={styles.lead}>Завантажуємо курс…</p>
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
  const ratio = standing.totalLessons > 0 ? standing.completedLessons / standing.totalLessons : 0;

  // Reference material is listed apart from the protocol: it is a handbook you
  // consult, not a step you complete.
  const steps = outline.filter((entry) => !entry.isReference);
  const reference = outline.filter((entry) => entry.isReference);

  return (
    <main className={styles.wrap} data-cw-platform-template="learn-course">
      <p className={styles.eyebrow}>Мій маршрут</p>
      <h1 className={styles.title}>{course.title}</h1>
      {course.summary ? <p className={styles.lead}>{inlineToPlainText(course.summary)}</p> : null}

      <div className={styles.standing}>
        <span className={styles.chip}>
          {standing.completedLessons} з {standing.totalLessons} пройдено
        </span>
        {standing.currentDay !== null ? <span className={styles.chip}>День {standing.currentDay}</span> : null}
        {standing.isFinished ? <span className={styles.chip}>Курс завершено</span> : null}
      </div>

      <div
        className={styles.progressTrack}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={standing.totalLessons}
        aria-valuenow={standing.completedLessons}
        aria-label="Прогрес курсу"
      >
        <div className={styles.progressFill} style={{ width: `${Math.round(ratio * 100)}%` }} />
      </div>

      <ul className={styles.outline}>
        {steps.map((entry) => {
          const href = `/learn/${course.slug}/${entry.slug}`;
          const badgeLabel = entry.dayIndex ?? "•";
          const isCurrent = entry.slug === currentLessonSlug;

          const meta = [
            entry.durationMin ? `${entry.durationMin} хв` : null,
            isCurrent && !entry.completed ? "продовжити" : null,
          ]
            .filter(Boolean)
            .join(" · ");

          if (!entry.availability.available) {
            const lockText =
              entry.availability.reason === "locked_by_day"
                ? entry.availability.daysRemaining === 1
                  ? "відкриється завтра"
                  : `через ${entry.availability.daysRemaining} дн.`
                : "спершу заверши попередній крок";

            return (
              <li key={entry.lessonId} className={styles.outlineItem}>
                <div className={styles.outlineLocked} aria-disabled="true">
                  <span className={styles.dayBadge} aria-hidden="true">
                    {badgeLabel}
                  </span>
                  <div>
                    <h2 className={styles.outlineTitle}>{entry.title}</h2>
                    <p className={styles.outlineMeta}>{lockText}</p>
                  </div>
                  <span className={styles.outlineState} aria-label="Закрито">
                    ✕
                  </span>
                </div>
              </li>
            );
          }

          return (
            <li key={entry.lessonId} className={styles.outlineItem}>
              <Link className={styles.outlineLink} href={href}>
                <span className={entry.completed ? styles.dayBadgeDone : styles.dayBadge} aria-hidden="true">
                  {badgeLabel}
                </span>
                <div>
                  <h2 className={styles.outlineTitle}>{entry.title}</h2>
                  {meta ? <p className={styles.outlineMeta}>{meta}</p> : null}
                </div>
                <span className={styles.outlineState}>{entry.completed ? "готово" : "відкрити"}</span>
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
                <Link className={styles.outlineLink} href={`/learn/${course.slug}/${entry.slug}`}>
                  <span className={styles.dayBadge} aria-hidden="true">
                    ★
                  </span>
                  <div>
                    <h3 className={styles.outlineTitle}>{entry.title}</h3>
                    {entry.durationMin ? (
                      <p className={styles.outlineMeta}>{entry.durationMin} хв</p>
                    ) : null}
                  </div>
                  <span className={styles.outlineState}>відкрити</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
