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
 * WHERE THE MAPPING COMES FROM (2026-09-26). The same tables the checkout
 * reads: `offer_aliases` knows every spelling a code was sold under,
 * `experience_offers` which thing each offer sells, and `lms_courses` which
 * course delivers it. The hand-written `PRODUCTS` entries it used to read are
 * gone. If the report and the checkout ever disagreed about what a code is,
 * the report would be the least of it — so they read the same rows.
 */

import type { Db } from "@/lib/db/server";
import { parseCourseOfferCode } from "@/lms-core/offerCode";

const CONTENT_KINDS = new Set(["course", "mini", "checklist"]);

export type ProductIdentity = {
  /**
   * The key a report groups on: one row per course, not per historical
   * spelling of it. `course:<slug>` for anything a course delivers — its own
   * offer, a format, a package, a legacy landing code; the offer's own code
   * for a thing with no course (`consult`, `herbs`); the code itself when
   * nothing knows it, so an unknown code stays visibly itself.
   */
  key(code: string | null | undefined, fallback?: string): string;
  /** The title a person recognises, for a code or a key; null when there is none to show. */
  title(code: string | null | undefined): string | null;
};

type OfferRow = { id: string; code: string; experience_id: string };
type ThingRow = { id: string; kind: string; title: string | null };
type CourseRow = { slug: string; title: string | null; experience_id: string | null; created_at: string | null };

async function rows<T>(db: Pick<Db, "from">, table: string, columns: string): Promise<T[]> {
  try {
    const { data, error } = await db.from(table as never).select(columns);
    return error || !data ? [] : (data as unknown as T[]);
  } catch {
    return [];
  }
}

/**
 * The vocabulary for one report, read once. Four small tables; a failed read
 * degrades to "codes as themselves" rather than to a failed report.
 */
export async function loadProductIdentity(db: Pick<Db, "from">): Promise<ProductIdentity> {
  const [offers, aliases, things, courses] = await Promise.all([
    rows<OfferRow>(db, "experience_offers", "id, code, experience_id"),
    rows<{ code: string; offer_id: string }>(db, "offer_aliases", "code, offer_id"),
    rows<ThingRow>(db, "experiences", "id, kind, title"),
    rows<CourseRow>(db, "lms_courses", "slug, title, experience_id, created_at"),
  ]);
  return buildProductIdentity({ offers, aliases, things, courses });
}

/** The pure half, for tests and for a caller that already holds the rows. */
export function buildProductIdentity(input: {
  offers: OfferRow[];
  aliases: { code: string; offer_id: string }[];
  things: ThingRow[];
  courses: CourseRow[];
}): ProductIdentity {
  const offerById = new Map(input.offers.map((offer) => [offer.id, offer]));
  const offerByCode = new Map<string, OfferRow>();
  for (const alias of input.aliases) {
    const offer = offerById.get(alias.offer_id);
    if (offer) offerByCode.set(alias.code.toLowerCase(), offer);
  }
  // A live code wins over an alias, as it does at the checkout.
  for (const offer of input.offers) offerByCode.set(offer.code.toLowerCase(), offer);

  const thingById = new Map(input.things.map((thing) => [thing.id, thing]));
  const courseTitle = new Map(input.courses.map((course) => [course.slug, course.title?.trim() || course.slug]));
  const firstCourseOf = new Map<string, string>();
  for (const course of [...input.courses].sort((a, b) => (a.created_at ?? "").localeCompare(b.created_at ?? ""))) {
    if (course.experience_id && !firstCourseOf.has(course.experience_id)) {
      firstCourseOf.set(course.experience_id, course.slug);
    }
  }

  function key(code: string | null | undefined, fallback = "unknown"): string {
    const trimmed = (code ?? "").trim();
    if (!trimmed) return fallback;
    const offer = offerByCode.get(trimmed.toLowerCase());
    if (!offer) {
      const slug = parseCourseOfferCode(trimmed);
      return slug ? `course:${slug}` : trimmed;
    }
    const thing = thingById.get(offer.experience_id);
    if (thing && CONTENT_KINDS.has(thing.kind)) {
      const slug = parseCourseOfferCode(offer.code) ?? firstCourseOf.get(offer.experience_id);
      if (slug) return `course:${slug}`;
    }
    return offer.code;
  }

  function title(code: string | null | undefined): string | null {
    const canonical = key(code, "");
    if (!canonical) return null;
    const slug = parseCourseOfferCode(canonical);
    if (slug) return courseTitle.get(slug) ?? null;
    const offer = offerByCode.get(canonical.toLowerCase());
    return (offer && thingById.get(offer.experience_id)?.title?.trim()) || null;
  }

  return { key, title };
}
