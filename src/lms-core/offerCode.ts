/**
 * CenterWay LMS core — the product code a course is sold under.
 *
 * PURE TS. No DOM, no React, no Next, no npm deps.
 *
 * WHY THIS IS HERE AND NOT IN THE PAYMENT LAYER. Two places have to agree on
 * the string `course:<slug>` and they sit on opposite sides of the purchase:
 * the checkout writes it into `orders.product_code`, and the entitlement reads
 * it back to decide whether the buyer may open the course. When those two
 * built the code separately, the failure was the worst kind — the payment
 * succeeds, the money moves, and the learner is told they own nothing.
 *
 * One function builds it, one parses it, and `resolveEntitlement` accepts a
 * course's own code without anyone having to remember to list it.
 */

export const COURSE_OFFER_PREFIX = "course:";

/** The payable product code for a course out of the builder. */
export function courseOfferCode(slug: string): string {
  return `${COURSE_OFFER_PREFIX}${slug}`;
}

/**
 * The slug inside a `course:<slug>` code, or null for anything else.
 *
 * Shape-checked rather than trusted: the code arrives from a query string on
 * the payment route, and it becomes a database lookup. The character class is
 * the one `slugify` produces and nothing wider.
 */
export function parseCourseOfferCode(code: unknown): string | null {
  if (typeof code !== "string" || !code.startsWith(COURSE_OFFER_PREFIX)) return null;
  const slug = code.slice(COURSE_OFFER_PREFIX.length);
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) ? slug : null;
}

export function isCourseOfferCode(code: unknown): boolean {
  return parseCourseOfferCode(code) !== null;
}
