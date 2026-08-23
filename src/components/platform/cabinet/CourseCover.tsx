"use client";

/**
 * The course's cover, on the learner's side of the product.
 *
 * ONE IMAGE, EVERY SURFACE. The cover is set once by the author on
 * `lms_courses.cover` and is already read by the catalogue and the offer page
 * (`src/lib/platform/offers.ts`). Until now the learner never saw it: the shelf
 * and the dashboard drew courses as text, so the picture a buyer chose the
 * course by disappeared the moment they owned it.
 *
 * NOT A GREY BOX WHEN THERE IS NONE. A course without a cover still has a name,
 * and two initials on a warm ground tell two cards apart at a glance — which is
 * the whole job of a cover on a shelf. Reserving an empty rectangle instead
 * would cost the same space and say nothing. Same reasoning, and the same
 * shape, as the builder's own grid.
 *
 * A BAND, NOT A POSTER. The shelf is scanned, not browsed: at 16/9 four courses
 * push the first action below the fold on a phone, and the reader came here to
 * continue one of them, not to look at pictures.
 */

import type { LearnerShelfCourseDto } from "@/components/lms/lmsClient";
import styles from "./Cabinet.module.css";

/** Up to two words, first letters — the builder's rule, so the two agree. */
function initialsOf(title: string): string {
  return title
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join("");
}

export function CourseCover({ course, dimmed }: { course: LearnerShelfCourseDto; dimmed?: boolean }) {
  if (course.cover) {
    return (
      // Plain <img>: the cover is an author-supplied path that may point
      // anywhere, and next/image would need every one of those hosts configured
      // before it would render at all. Same call the builder made.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        className={styles.cover}
        data-dimmed={dimmed || undefined}
        src={course.cover.src}
        alt={course.cover.alt}
        style={{ objectPosition: `center ${course.cover.cropY ?? 50}%` }}
      />
    );
  }

  return (
    <span className={styles.coverFallback} data-dimmed={dimmed || undefined} aria-hidden="true">
      {initialsOf(course.title)}
    </span>
  );
}
