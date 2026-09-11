/**
 * CenterWay LMS core — the reader's journal.
 *
 * PURE TS. No DOM, no React, no Next, no npm deps — `Intl` only, through
 * `./time`.
 *
 * The marks a reader makes live one course at a time: `CourseNotes` lists what
 * was written inside the course it was written in, and that is the right answer
 * to «where in this material». The journal asks the other question — «what have
 * I written» — and it has no course to scope it, so its axis is TIME.
 *
 * TWO RULES SHAPE EVERYTHING HERE.
 *
 * Nothing is dropped. A mark whose lesson cannot be named still appears, with
 * the text the reader saved and no link — the same promise `resolveAnchor`
 * makes about a quote that no longer matches: detached, never deleted. A read
 * path that quietly filters is how a shelf loses courses (`shelfHealth` exists
 * because that already happened once), and this list is the reader's own
 * writing, which is worse to lose than a card.
 *
 * Access is not a filter either. When a course window has closed, the entries
 * made inside it stay and say so. Expiry ends access to somebody else's text;
 * it was never a claim on what the reader wrote about it.
 */

import type { AnnotationKind } from "./annotations";
import { formatCalendarDate, localCalendarDate } from "./time";

/** One stored mark, already stripped of the anchor arithmetic the journal cannot use. */
export type JournalMark = {
  clientId: string;
  enrollmentId: string;
  lessonId: string;
  kind: AnnotationKind;
  /** The passage as it read when it was marked. `null` for a bookmark. */
  quote: string | null;
  note: string | null;
  /** The block the mark sits in, for the deep link. */
  blockId: string | null;
  createdAt: string;
  updatedAt: string;
};

/**
 * Where one enrollment's marks belong: the course, and the lessons of it this
 * reader could be pointed at.
 */
export type JournalPlace = {
  enrollmentId: string;
  courseSlug: string;
  courseTitle: string;
  /** False when the reader's window on this course has closed or was revoked. */
  open: boolean;
  lessons: Array<{ id: string; slug: string; title: string }>;
};

export type JournalEntry = {
  clientId: string;
  kind: AnnotationKind;
  quote: string | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  /** `null` when the course behind the mark can no longer be named. */
  course: { slug: string; title: string; open: boolean } | null;
  lesson: { slug: string; title: string } | null;
  /**
   * The INTERNAL path to the passage — `/learn/…` — or `null` when there is no
   * place to send the reader. The caller turns it into an address for the
   * surface it is rendering on; this module does not know which host that is.
   */
  path: string | null;
};

/** A day of the journal, in the reader's own timezone. */
export type JournalDay = {
  /** `YYYY-MM-DD`, local. The heading, and a stable key. */
  date: string;
  entries: JournalEntry[];
};

type Located = { place: JournalPlace; lesson: JournalPlace["lessons"][number] };

function lessonIndex(places: JournalPlace[]): Map<string, Located> {
  const index = new Map<string, Located>();
  for (const place of places) {
    for (const lesson of place.lessons) {
      // Keyed by enrollment AND lesson: a lesson id is only unique inside the
      // course it belongs to, and one reader can hold two enrollments.
      index.set(`${place.enrollmentId}:${lesson.id}`, { place, lesson });
    }
  }
  return index;
}

/**
 * Every mark, newest first, named where it can be named.
 *
 * Sorted on `createdAt` rather than `updatedAt`: a journal records when
 * something was written, and editing a note two weeks later must not lift the
 * entry out of the day it belongs to.
 */
export function buildJournalEntries(marks: JournalMark[], places: JournalPlace[]): JournalEntry[] {
  const byLesson = lessonIndex(places);
  const byEnrollment = new Map(places.map((place) => [place.enrollmentId, place]));

  return [...marks]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.clientId.localeCompare(b.clientId))
    .map((mark) => {
      const found = byLesson.get(`${mark.enrollmentId}:${mark.lessonId}`) ?? null;
      // The course can still be nameable when the lesson is not: an outline
      // that moved under a cached id costs the link, not the entry.
      const place = found?.place ?? byEnrollment.get(mark.enrollmentId) ?? null;

      const path = found
        ? `/learn/${found.place.courseSlug}/${found.lesson.slug}${mark.blockId ? `#block-${mark.blockId}` : ""}`
        : null;

      return {
        clientId: mark.clientId,
        kind: mark.kind,
        quote: mark.quote,
        note: mark.note,
        createdAt: mark.createdAt,
        updatedAt: mark.updatedAt,
        course: place ? { slug: place.courseSlug, title: place.courseTitle, open: place.open } : null,
        lesson: found ? { slug: found.lesson.slug, title: found.lesson.title } : null,
        path,
      };
    });
}

/**
 * The same list, cut into the reader's local days.
 *
 * The cut is local rather than UTC because the heading is read as «that
 * evening», and a note made at 01:00 in Kyiv belongs to the night it was
 * written rather than to the day before it in UTC.
 */
export function groupJournalByDay(entries: JournalEntry[], timeZone: string): JournalDay[] {
  const days: JournalDay[] = [];
  let current: JournalDay | null = null;

  for (const entry of entries) {
    const at = new Date(entry.createdAt);
    // An unreadable timestamp is not a reason to lose the entry; it lands in a
    // day of its own rather than taking the list down.
    const date = Number.isNaN(at.getTime()) ? "" : formatCalendarDate(localCalendarDate(at, timeZone));

    if (!current || current.date !== date) {
      current = { date, entries: [] };
      days.push(current);
    }
    current.entries.push(entry);
  }

  return days;
}
