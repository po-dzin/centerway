import type { CourseCategory } from "@/lms-core";

import type { CatalogRow } from "./catalogTypes";

/**
 * HOW THE CATALOGUE LIST IS NARROWED AND ORDERED — the admin's half of the card
 * system (docs/card-system-2026-09-13.md).
 *
 * A list of eleven courses could be read top to bottom; a list of forty, with a
 * creator submitting one on a Sunday, cannot. The two questions an operator
 * actually opens this page with are «what is waiting for me?» and «where is the
 * course called …?», so those are the two groupings that come first. Everything
 * here is a pure function of the rows the API already returned: grouping is a
 * way of LOOKING at the list, it never asks the server for a different one.
 */

export type CatalogGrouping = "submitted" | "alphabet" | "status" | "updated";

export const CATALOG_GROUPINGS: readonly CatalogGrouping[] = ["submitted", "alphabet", "status", "updated"];

/** A category code, `none` for a course nobody has categorised, or everything. */
export type CatalogCategoryFilter = CourseCategory | "none" | "all";

export type CatalogQuery = {
  text: string;
  category: CatalogCategoryFilter;
};

export type CatalogGroupLabels = {
  inReview: string;
  changesRequested: string;
  rest: string;
  listed: string;
  unlisted: string;
  hidden: string;
  draft: string;
};

export type CatalogGroup = {
  key: string;
  /** Null for the one grouping that has no sections — the list as it came. */
  label: string | null;
  rows: CatalogRow[];
};

/** The review state that is actually waiting: the pending revision's when there is one. */
export function effectiveReviewStatus(row: CatalogRow): string {
  return row.hasPendingRevision && row.pendingReviewStatus ? row.pendingReviewStatus : row.reviewStatus;
}

export function filterCatalogRows(rows: readonly CatalogRow[], query: CatalogQuery): CatalogRow[] {
  const needle = query.text.trim().toLowerCase();
  return rows.filter((row) => {
    if (needle && !row.title.toLowerCase().includes(needle) && !row.slug.toLowerCase().includes(needle)) {
      return false;
    }
    if (query.category === "all") return true;
    if (query.category === "none") return row.categories.length === 0;
    return row.categories.includes(query.category);
  });
}

/* Newest first, and a row that was never submitted sorts after every one that
   was: an absent date is not «the oldest submission», it is no submission. */
function bySubmittedDesc(a: CatalogRow, b: CatalogRow): number {
  if (a.submittedAt && b.submittedAt) return b.submittedAt.localeCompare(a.submittedAt);
  if (a.submittedAt) return -1;
  if (b.submittedAt) return 1;
  return byUpdatedDesc(a, b);
}

function byUpdatedDesc(a: CatalogRow, b: CatalogRow): number {
  return b.updatedAt.localeCompare(a.updatedAt);
}

/* The title as it is filed: an opening quote or bracket is typography, not the
   first letter anyone looks a course up by. Sorting reads this too, so
   «Ідеальне тіло» sits among the І's rather than ahead of every letter. */
function filingTitle(title: string): string {
  return title.trim().replace(/^[«"'“„(\[]+/, "");
}

function byTitle(locale: string) {
  const collator = new Intl.Collator(locale, { sensitivity: "base", numeric: true });
  return (a: CatalogRow, b: CatalogRow) => collator.compare(filingTitle(a.title), filingTitle(b.title));
}

/* The letter a title is filed under; a title that opens with a digit or a
   symbol files under «#», which sorts ahead of the alphabet. */
function initialOf(title: string, locale: string): string {
  const first = filingTitle(title).charAt(0);
  if (!first || !/\p{L}/u.test(first)) return "#";
  return first.toLocaleUpperCase(locale);
}

function sections(
  entries: readonly { key: string; label: string; rows: CatalogRow[] }[],
): CatalogGroup[] {
  return entries.filter((entry) => entry.rows.length > 0);
}

export function groupCatalogRows(
  rows: readonly CatalogRow[],
  grouping: CatalogGrouping,
  labels: CatalogGroupLabels,
  locale: string,
): CatalogGroup[] {
  if (rows.length === 0) return [];

  if (grouping === "updated") {
    return [{ key: "all", label: null, rows: [...rows].sort(byUpdatedDesc) }];
  }

  if (grouping === "submitted") {
    const inReview = rows.filter((row) => effectiveReviewStatus(row) === "in_review").sort(bySubmittedDesc);
    const returned = rows.filter((row) => effectiveReviewStatus(row) === "changes_requested").sort(bySubmittedDesc);
    const waiting = new Set([...inReview, ...returned]);
    const rest = rows.filter((row) => !waiting.has(row)).sort(byUpdatedDesc);
    return sections([
      { key: "in_review", label: labels.inReview, rows: inReview },
      { key: "changes_requested", label: labels.changesRequested, rows: returned },
      { key: "rest", label: labels.rest, rows: rest },
    ]);
  }

  if (grouping === "status") {
    const inReview = rows.filter((row) => effectiveReviewStatus(row) === "in_review");
    const claimed = new Set(inReview);
    const pick = (predicate: (row: CatalogRow) => boolean) => {
      const picked = rows.filter((row) => !claimed.has(row) && predicate(row));
      picked.forEach((row) => claimed.add(row));
      return picked.sort(byTitle(locale));
    };
    const draft = pick((row) => row.status !== "published");
    const listed = pick((row) => row.visibility === "listed");
    const unlisted = pick((row) => row.visibility === "unlisted");
    const hidden = pick(() => true);
    return sections([
      { key: "in_review", label: labels.inReview, rows: inReview.sort(bySubmittedDesc) },
      { key: "listed", label: labels.listed, rows: listed },
      { key: "unlisted", label: labels.unlisted, rows: unlisted },
      { key: "hidden", label: labels.hidden, rows: hidden },
      { key: "draft", label: labels.draft, rows: draft },
    ]);
  }

  const sorted = [...rows].sort(byTitle(locale));
  const byLetter = new Map<string, CatalogRow[]>();
  for (const row of sorted) {
    const letter = initialOf(row.title, locale);
    byLetter.set(letter, [...(byLetter.get(letter) ?? []), row]);
  }
  const letters = [...byLetter.entries()].sort(([a], [b]) => (a === "#" ? -1 : b === "#" ? 1 : 0));
  return letters.map(([letter, letterRows]) => ({
    key: `letter:${letter}`,
    label: letter,
    rows: letterRows,
  }));
}
