/**
 * One vocabulary for "which product is this order for", shared by every
 * reporting surface.
 *
 * WHY THIS EXISTS. Three places had each grown their own answer, and all three
 * were written before the builder started selling courses on 2026-08-26:
 * `formatProductName` in the admin analytics page knew exactly three names
 * (`short`, `reboot`, `irem`), `productLabel` in `analyticsReports.ts` knew a
 * slightly different three, and the analytics API knew none — it grouped on the
 * raw `orders.product_code` string. So a real, priced, sold course printed as
 * `course:natural-body` on the dashboard and as "Невідомий продукт" in
 * Telegram, and nobody could tell from either that the two were the same sale.
 *
 * THE SECOND HALF OF THE PROBLEM IS WORSE THAN THE LABELS. A product code is
 * not a product. `short` (the landing's code, 239 orders) and `course:short`
 * (the platform's code for the same course, 15 orders) were two separate rows
 * in the product breakdown, so one course's revenue was reported split down a
 * naming boundary that exists only in our own history. `canonicalProductKey`
 * folds them: both resolve through their course slug, because that is what the
 * buyer actually bought.
 *
 * The legacy half of that mapping is not invented here either — it is read off
 * `PRODUCTS[code].fulfilment.courseSlug`, the same field the checkout uses to
 * decide which course to open after payment. If those two ever disagreed, the
 * report would be the least of it.
 */

import { parseCourseOfferCode } from "@/lms-core/offerCode";
import { PRODUCTS } from "@/lib/products";

/** The course a product code delivers, whichever vocabulary the code is in. */
export function productCourseSlug(code: string | null | undefined): string | null {
  const trimmed = (code ?? "").trim();
  if (!trimmed) return null;

  const fromOfferCode = parseCourseOfferCode(trimmed);
  if (fromOfferCode) return fromOfferCode;

  const legacy = (PRODUCTS as Record<string, { fulfilment?: { kind: string; courseSlug?: string } }>)[trimmed];
  const fulfilment = legacy?.fulfilment;
  if (fulfilment?.kind === "course" && typeof fulfilment.courseSlug === "string") {
    return fulfilment.courseSlug;
  }
  return null;
}

/**
 * The key a report should group on: one row per course, not per historical
 * spelling of the same course. Codes that deliver no course (a consultation,
 * a cabinet product, a code we no longer recognise) keep themselves.
 */
export function canonicalProductKey(code: string | null | undefined, fallback = "unknown"): string {
  const slug = productCourseSlug(code);
  if (slug) return `course:${slug}`;
  const trimmed = (code ?? "").trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

/**
 * Titles for a batch of product codes, one query for the whole report.
 *
 * Keyed by canonical key, so a caller that grouped with `canonicalProductKey`
 * can look a row up directly. Courses are titled from `lms_courses` — the row
 * the author edits — so renaming a course in the builder renames it in every
 * report without a deploy.
 */
export async function resolveProductTitles(
  db: { from: (table: string) => any },
  codes: Iterable<string | null | undefined>
): Promise<Map<string, string>> {
  const slugs = new Set<string>();
  for (const code of codes) {
    const slug = productCourseSlug(code);
    if (slug) slugs.add(slug);
  }

  const titles = new Map<string, string>();
  if (slugs.size === 0) return titles;

  const { data } = await db.from("lms_courses").select("slug, title").in("slug", [...slugs]);
  for (const row of (data ?? []) as Array<{ slug: string; title: string | null }>) {
    titles.set(`course:${row.slug}`, row.title?.trim() || row.slug);
  }
  return titles;
}
