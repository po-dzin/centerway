"use client";

/**
 * Everything the reader marked in this course, in one place.
 *
 * WITHOUT THIS THE MARKS ARE WRITE-ONLY. A highlight you can only find by
 * re-reading the lesson it is in is a highlight that has to be remembered to be
 * used, which is the problem it was made to solve. The course map is where a
 * reader already goes to ask "where was that", so the answer belongs here
 * rather than behind a fourth button in the lesson's chrome.
 *
 * Order is the course's own — lesson by lesson, and inside a lesson the order
 * the passages are read in — never "most recent first". A protocol is a
 * sequence; a list of notes about it that jumps around is a second thing to
 * navigate.
 */

import Link from "next/link";

import { Icon } from "@/components/Icon";
import { annotationLabel, type Annotation } from "@/lms-core";
import type { CourseOutlineEntryDto } from "./lmsClient";
import styles from "./Lms.module.css";

export function CourseNotes({
  courseSlug,
  outline,
  annotations,
  onRemove,
  href,
}: {
  courseSlug: string;
  outline: CourseOutlineEntryDto[];
  annotations: Annotation[];
  onRemove: (clientId: string) => void;
  href: (path: string) => string;
}) {
  if (annotations.length === 0) return null;

  const bySlug = new Map<string, Annotation[]>();
  for (const item of annotations) {
    const list = bySlug.get(item.lessonSlug);
    if (list) list.push(item);
    else bySlug.set(item.lessonSlug, [item]);
  }

  // Walk the outline, not the marks: that is what puts them in reading order,
  // and it also drops anything left over from a lesson that no longer exists.
  const groups = outline
    .map((entry) => ({ entry, items: bySlug.get(entry.slug) ?? [] }))
    .filter((group) => group.items.length > 0);

  return (
    <section className={styles.notesSection}>
      <h2 className={styles.referenceHeading}>Мої позначки</h2>
      <p className={styles.referenceLead}>
        Закладки, виділення і нотатки на полях. Бачите тільки ви.
      </p>

      {groups.map(({ entry, items }) => (
        <div key={entry.lessonId} className={styles.notesGroup}>
          <Link className={styles.notesLesson} href={href(`/learn/${courseSlug}/${entry.slug}`)}>
            {entry.title}
          </Link>

          <ul className={styles.notesList}>
            {items.map((item) => (
              <li key={item.clientId} className={styles.notesItem}>
                <Link
                  className={styles.notesLink}
                  // Straight to the block the mark sits in. The lesson treats an
                  // explicit hash as "take me here", so it overrides the saved
                  // reading position rather than fighting it.
                  href={href(
                    `/learn/${courseSlug}/${entry.slug}${item.anchor ? `#block-${item.anchor.blockId}` : ""}`
                  )}
                >
                  <span className={styles.notesGlyph} aria-hidden="true">
                    <Icon name={item.kind === "bookmark" ? "star" : "quote"} size={14} />
                  </span>
                  <span className={styles.notesBody}>
                    {item.kind === "bookmark" ? (
                      <span className={styles.notesQuote}>Закладка на урок</span>
                    ) : (
                      <>
                        <span className={styles.notesQuote}>{item.anchor?.quote}</span>
                        {item.note ? <span className={styles.notesNote}>{annotationLabel(item)}</span> : null}
                      </>
                    )}
                  </span>
                </Link>

                <button
                  className={styles.iconButtonBare}
                  type="button"
                  aria-label="Прибрати позначку"
                  onClick={() => onRemove(item.clientId)}
                >
                  <Icon name="close" size={16} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
