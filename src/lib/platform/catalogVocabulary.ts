/**
 * THE CATALOGUE'S WORDS FOR ITS CLOSED CODES — one table each, and only here.
 *
 * `kind` and `categories` are closed lists so that a shelf can be filtered by
 * them (see `COURSE_CATEGORIES` in lms-core). The price of a closed list is
 * that something has to turn a code into a word, and the moment two places do
 * it the card says «Міні-курс» while the filter offers «Мінікурс» — two
 * vocabularies for one list, which is the exact failure the closed list exists
 * to prevent.
 *
 * SEPARATE FROM BOTH READERS ON PURPOSE. The storefront reads these on the
 * server (`offers.ts`, which opens a database client) and the catalogue's
 * filter reads them in the browser. A shared table that lived in either one
 * would drag that one's imports into the other's bundle; this module imports
 * nothing but the codes themselves.
 */

import type { CourseCategory, CourseKind } from "@/lms-core";

/**
 * What each kind is CALLED on a card — the badge in the corner of the plate,
 * and the same word the filter offers to narrow by.
 */
export const COURSE_KIND_BADGES: Record<CourseKind, string> = {
  course: "Курс",
  mini: "Міні-курс",
  checklist: "Чек-лист",
};

/** What each subject is called, in the reader's language. */
export const COURSE_CATEGORY_LABELS: Record<CourseCategory, string> = {
  movement: "Рух",
  nutrition: "Харчування",
  cleansing: "Очищення",
};
