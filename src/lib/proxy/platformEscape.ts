import { NextRequest, NextResponse } from "next/server";

import { PERSONAL_ORIGIN, PLATFORM_ORIGIN, isPersonalPath } from "@/lib/surfaces/catalog";

/**
 * The way off a funnel host and back onto the platform.
 *
 * A funnel host owns exactly one landing. Everything else it is asked for ends
 * at `rewriteDisabledSurface` — a 404 — and for a marketing path that is the
 * right answer: `way21.centerway.net.ua/products` is not a page anybody should
 * be able to reach. For an ACCOUNT path it is the wrong answer twice over.
 *
 * The session cookie is scoped to the platform origin, so even if these routes
 * rendered here they would render signed out: a buyer who followed a relative
 * `/profile` off a landing would be told to log in, on a host where logging in
 * cannot stick. A redirect is not a nicety, it is the only outcome that leads
 * anywhere.
 *
 * Prefix-matched and explicit. Not "redirect whatever the landing did not
 * claim" — that would turn every typo and every crawler's guess into a 302 to
 * the platform, and a 404 is what a URL that does not exist should say.
 */
const PLATFORM_ESCAPE_PREFIXES = [
  "/profile",
  "/learn",
  "/admin",
  "/legal",
  "/pay",
  "/programs",
  "/products",
  /* Kept after the merge: this path still has to reach the platform so the
     platform can serve its 308 to /consult. Drop it and the funnel host answers
     instead, and the redirect never runs. */
  "/expert",
  "/consult",
  "/tests",
  "/dosha-test",
] as const;

export function isPlatformEscapePath(pathname: string): boolean {
  const clean = pathname.toLowerCase();
  return PLATFORM_ESCAPE_PREFIXES.some((prefix) => clean === prefix || clean.startsWith(`${prefix}/`));
}

/**
 * 307, not 308. These are platform routes reached from the wrong host, not
 * addresses that moved — and one of them (`/tests` on the dosha host) is
 * deliberately served in place. A permanent redirect would be cached in every
 * browser that ever followed it, and taking it back later would be impossible.
 */
export function redirectToPlatformOrigin(req: NextRequest): NextResponse {
  /* The origin that OWNS the path, not the platform's by default: `/profile`
     and `/learn` live on `my` now, and sending them to `www` would spend a
     second hop on a 308 that already exists there. */
  const owner = isPersonalPath(req.nextUrl.pathname) ? PERSONAL_ORIGIN : PLATFORM_ORIGIN;
  const target = new URL(`${req.nextUrl.pathname}${req.nextUrl.search}`, owner);
  return NextResponse.redirect(target, 307);
}
