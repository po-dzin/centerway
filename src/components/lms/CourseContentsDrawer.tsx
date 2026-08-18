"use client";

/**
 * Course contents, reachable from inside a lesson.
 *
 * Answers "how much is there, and where am I?" without leaving the step the
 * learner is on — the sequential player alone hides the shape of the course.
 * A bottom sheet on phones, a centred dialog on wider screens.
 */

import { useCallback, useEffect, useRef } from "react";
import Link from "next/link";

import type { CourseOutlineEntryDto } from "./lmsClient";
import styles from "./Lms.module.css";

export function CourseContentsDrawer({
  courseSlug,
  outline,
  currentSlug,
  onClose,
}: {
  courseSlug: string;
  outline: CourseOutlineEntryDto[];
  currentSlug: string;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    // The page behind a sheet must not scroll under the finger.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  const onBackdropClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (!panelRef.current?.contains(event.target as Node)) onClose();
    },
    [onClose]
  );

  const completed = outline.filter((entry) => entry.completed).length;

  // Group by module so the course reads as sections, not one long list.
  const groups: Array<{ id: string; title: string; entries: CourseOutlineEntryDto[] }> = [];
  for (const entry of outline) {
    const last = groups[groups.length - 1];
    if (last && last.id === entry.moduleId) last.entries.push(entry);
    else groups.push({ id: entry.moduleId, title: entry.moduleTitle, entries: [entry] });
  }

  return (
    <div className={styles.drawerBackdrop} onClick={onBackdropClick} role="presentation">
      <div className={styles.drawer} ref={panelRef} role="dialog" aria-modal="true" aria-label="Зміст курсу">
        <div className={styles.drawerHandle} aria-hidden="true" />

        <div className={styles.drawerHead}>
          <h2 className={styles.drawerTitle}>Зміст курсу</h2>
          <button ref={closeRef} className={styles.iconButton} type="button" onClick={onClose}>
            Закрити
          </button>
        </div>

        <p className={styles.pagerLabel}>
          Пройдено {completed} з {outline.length}
        </p>

        {groups.map((group) => (
          <div key={group.id}>
            <p className={styles.drawerModule}>{group.title}</p>
            {group.entries.map((entry) => {
              const isCurrent = entry.slug === currentSlug;
              const meta = [
                entry.dayIndex ? `День ${entry.dayIndex}` : null,
                entry.durationMin ? `${entry.durationMin} хв` : null,
              ]
                .filter(Boolean)
                .join(" · ");

              if (!entry.availability.available) {
                return (
                  <div key={entry.lessonId} className={styles.drawerItemLocked} aria-disabled="true">
                    <span className={styles.drawerMark} aria-hidden="true">
                      ✕
                    </span>
                    <span>
                      {entry.title}
                      <span className={styles.drawerMeta}>
                        {entry.availability.reason === "locked_by_day"
                          ? `відкриється через ${entry.availability.daysRemaining} дн.`
                          : "спершу заверши попередній крок"}
                      </span>
                    </span>
                  </div>
                );
              }

              return (
                <Link
                  key={entry.lessonId}
                  className={isCurrent ? styles.drawerItemCurrent : styles.drawerItem}
                  href={`/learn/${courseSlug}/${entry.slug}`}
                  aria-current={isCurrent ? "page" : undefined}
                  onClick={onClose}
                >
                  <span
                    className={entry.completed ? styles.drawerMarkDone : styles.drawerMark}
                    aria-hidden="true"
                  >
                    {entry.completed ? "✓" : (entry.dayIndex ?? "•")}
                  </span>
                  <span>
                    {entry.title}
                    {meta ? <span className={styles.drawerMeta}>{meta}</span> : null}
                  </span>
                </Link>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
