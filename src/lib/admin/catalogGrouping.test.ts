import { describe, expect, it } from "vitest";

import type { CatalogRow } from "./catalogTypes";
import { effectiveReviewStatus, filterCatalogRows, groupCatalogRows } from "./catalogGrouping";

const labels = {
  inReview: "На модерації",
  changesRequested: "Повернуті автору",
  rest: "Решта",
  listed: "У каталозі",
  unlisted: "За посиланням",
  hidden: "Приховані",
  draft: "Чернетки",
};

function row(patch: Partial<CatalogRow> & { slug: string }): CatalogRow {
  return {
    courseId: patch.slug,
    programSlug: patch.slug,
    title: patch.slug,
    status: "published",
    reviewStatus: "approved",
    visibility: "listed",
    hasPendingRevision: false,
    pendingReviewStatus: null,
    pendingDiff: null,
    authorEmail: null,
    learners: 0,
    updatedAt: "2026-09-01T00:00:00Z",
    offer: null,
    blockers: [],
    cover: null,
    categories: [],
    submittedAt: null,
    ...patch,
  };
}

describe("filterCatalogRows", () => {
  const rows = [
    row({ slug: "way21", title: "Шлях 21", categories: ["nutrition", "cleansing"] }),
    row({ slug: "irem", title: "ІВЕМ-гімнастика", categories: ["movement"] }),
    row({ slug: "new", title: "Новий курс" }),
  ];

  it("matches title or slug, case-insensitively", () => {
    expect(filterCatalogRows(rows, { text: "шлях", category: "all" }).map((r) => r.slug)).toEqual(["way21"]);
    expect(filterCatalogRows(rows, { text: "IREM", category: "all" }).map((r) => r.slug)).toEqual(["irem"]);
  });

  it("narrows by a category code, and by «none» to the uncategorised", () => {
    expect(filterCatalogRows(rows, { text: "", category: "cleansing" }).map((r) => r.slug)).toEqual(["way21"]);
    expect(filterCatalogRows(rows, { text: "", category: "none" }).map((r) => r.slug)).toEqual(["new"]);
  });

  it("combines text and category as AND", () => {
    expect(filterCatalogRows(rows, { text: "курс", category: "movement" })).toEqual([]);
  });
});

describe("groupCatalogRows", () => {
  it("puts waiting submissions first, newest submission on top", () => {
    const rows = [
      row({ slug: "old-review", reviewStatus: "in_review", submittedAt: "2026-09-02T10:00:00Z" }),
      row({ slug: "live", updatedAt: "2026-09-12T00:00:00Z" }),
      row({ slug: "new-review", reviewStatus: "in_review", submittedAt: "2026-09-12T09:00:00Z" }),
      row({
        slug: "revision",
        hasPendingRevision: true,
        pendingReviewStatus: "in_review",
        submittedAt: "2026-09-10T09:00:00Z",
      }),
      row({ slug: "returned", reviewStatus: "changes_requested", submittedAt: "2026-09-11T00:00:00Z" }),
    ];
    const groups = groupCatalogRows(rows, "submitted", labels, "uk");
    expect(groups.map((g) => [g.label, g.rows.map((r) => r.slug)])).toEqual([
      ["На модерації", ["new-review", "revision", "old-review"]],
      ["Повернуті автору", ["returned"]],
      ["Решта", ["live"]],
    ]);
  });

  it("reads a pending revision's review state before the live one", () => {
    expect(
      effectiveReviewStatus(
        row({ slug: "x", reviewStatus: "approved", hasPendingRevision: true, pendingReviewStatus: "in_review" }),
      ),
    ).toBe("in_review");
  });

  it("files titles under their first letter in the locale's order, quotes ignored", () => {
    const rows = [
      row({ slug: "c", title: "Шлях 21" }),
      row({ slug: "a", title: "«Ідеальне тіло»" }),
      row({ slug: "b", title: "Ібіс" }),
      row({ slug: "d", title: "21 день" }),
    ];
    const groups = groupCatalogRows(rows, "alphabet", labels, "uk");
    expect(groups.map((g) => [g.label, g.rows.map((r) => r.slug)])).toEqual([
      ["#", ["d"]],
      ["І", ["b", "a"]],
      ["Ш", ["c"]],
    ]);
  });

  it("gives every row exactly one status section and drops empty ones", () => {
    const rows = [
      row({ slug: "draft", status: "draft", visibility: "hidden", reviewStatus: "draft" }),
      row({ slug: "listed" }),
      row({ slug: "hidden", visibility: "hidden" }),
      row({ slug: "waiting", status: "draft", reviewStatus: "in_review" }),
    ];
    const groups = groupCatalogRows(rows, "status", labels, "uk");
    expect(groups.map((g) => [g.key, g.rows.map((r) => r.slug)])).toEqual([
      ["in_review", ["waiting"]],
      ["listed", ["listed"]],
      ["hidden", ["hidden"]],
      ["draft", ["draft"]],
    ]);
    expect(groups.flatMap((g) => g.rows)).toHaveLength(rows.length);
  });

  it("keeps «updated» as one headerless list, newest first", () => {
    const rows = [
      row({ slug: "a", updatedAt: "2026-09-01T00:00:00Z" }),
      row({ slug: "b", updatedAt: "2026-09-09T00:00:00Z" }),
    ];
    expect(groupCatalogRows(rows, "updated", labels, "uk")).toEqual([
      { key: "all", label: null, rows: [rows[1], rows[0]] },
    ]);
  });

  it("returns no sections for an empty list", () => {
    expect(groupCatalogRows([], "submitted", labels, "uk")).toEqual([]);
  });
});
