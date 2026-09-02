/**
 * The offer's own landing page, when it still has one.
 *
 * WHY A PROGRAM PAGE POINTS AT A LANDING AT ALL. Five products were sold from a
 * hand-built funnel long before the platform had offer pages, and those funnels
 * say things the platform page deliberately does not: the long argument, the
 * screenshots of real messages, the before/after, the format comparison. The
 * platform page answers «що це і скільки коштує» in one screen; the landing
 * answers «переконайте мене». Losing the second one was never the plan — it was
 * just unreachable from the first.
 *
 * WHAT DECIDES WHETHER A SLUG HAS ONE. The surface registry, and nothing
 * written here: a landing exists when a product owns a funnel host, is active,
 * and its runtime actually serves a landing. There is no per-slug list to keep
 * in step with `src/lib/surfaces/catalog.ts`.
 *
 * THE PLATFORM ROUTE HAS TO AGREE. `getProductKeyByAlias` resolves legacy names
 * too — `detox` is an alias of `way21`, `short` of `reboot` — and a course
 * published under one of those names would otherwise inherit a landing that
 * sells a different address. So the product is accepted only when its own
 * `platformRoute` is the page asking. A builder course named `dosha` gets
 * nothing, which is right: the dosha host is a test, not this offer's landing.
 *
 * DIRECTION MATTERS. The isolation rule in the brand contract forbids a LANDING
 * from linking out to the platform hub; this is the opposite direction, and
 * inside one product — the offer page for Short Reboot pointing at the Short
 * Reboot funnel. No page gains a link to another author's funnel.
 */

import {
  getFunnelHostUrl,
  getProductKeyByAlias,
  getProductSurfaceEntry,
  isActiveFunnelProduct,
} from "@/lib/surfaces/catalog";

export function offerLandingUrl(programSlug: string): string | null {
  const product = getProductKeyByAlias(programSlug);
  if (!product) return null;

  const entry = getProductSurfaceEntry(product);
  if (entry.platformRoute !== `/programs/${programSlug}`) return null;
  if (!isActiveFunnelProduct(product)) return null;

  return getFunnelHostUrl(product);
}
