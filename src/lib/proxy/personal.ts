/**
 * Maps the personal host onto the personal routes, and keeps them off the
 * public one.
 *
 * Deliberately NOT part of the funnel-host machinery in ./landing.ts. That code
 * resolves a *product* from a host and then decides which landing surface to
 * serve; `my` is not a product and has no landing. It is one host and a set of
 * route prefixes.
 *
 * The personal host has no `/learn` in its addresses at all:
 *
 *   my.centerway.net.ua/            → /learn                 the dashboard
 *   my.centerway.net.ua/way21/day-1 → /learn/way21/day-1     a lesson
 *   my.centerway.net.ua/profile     → /profile               the cabinet
 *   my.centerway.net.ua/build/…     → /build/…               the builder
 *   my.centerway.net.ua/learn…      → 308 to the short form  it is not an address
 *   www.centerway.net.ua/learn/x    → 308 to `my/x`          the owner, short form
 *   www.centerway.net.ua/build/…    → 308 to `my/build/…`    same rule
 *   www.centerway.net.ua/profile    → 308 to `my/profile`    same rule
 *
 * The tree is the point. A dashboard at the root with lessons under `/learn/…`
 * meant children whose parent redirected away — so the prefix stopped being an
 * address and went back to being what it is: the route the pages live at.
 *
 * EVERY PERSONAL PATH ON A PUBLIC HOST FORWARDS TO ITS OWNER (2026-10-01).
 * Until then `/learn` and `/build` answered a bare 404 there, on the theory
 * that they "never had a public address" and a redirect would keep a second
 * one alive. Both halves were wrong. App code writes `/learn/…` as a relative
 * route everywhere, so any link that skips `surfaceHref` on a `www` page IS a
 * public address — the free-course button on `/programs/soul-daily-ritual`
 * was one, and it sent every reader who pressed it to Chrome's own «сторінку
 * не знайдено». And a 308 to the canonical origin does not keep a second
 * address alive; it is how one origin stays canonical, exactly as `www.my`
 * and the apex already are. So a stale link — a shared lesson, a queued
 * reminder, an app installed off an old `start_url`, a button that forgot to
 * resolve its href — now lands where it was aimed instead of on an empty 404.
 *
 * On the personal host an unclaimed path is a COURSE, so the public top-level
 * segments (`/legal/…`, `/programs`, `/products`) forward to `www` instead of
 * resolving as courses that do not exist. That list is `PUBLIC_ROOT_SEGMENTS`,
 * and a test walks the router to keep it from drifting.
 *
 * Anything else on the personal host goes to `www`, rather than 404ing: `my`
 * carries the installed app with scope "/", so a tap on a legal link inside it
 * has to land somewhere real.
 */

import { NextRequest, NextResponse } from "next/server";

import {
  LEARNING_PATH_PREFIX,
  PLATFORM_ORIGIN,
  canonicalPersonalPath,
  isPersonalPath,
  isPublicRootPath,
  personalRouteFor,
  personalUrl,
} from "@/lib/surfaces/catalog";
import { isPersonalHost as hostIsPersonal, servesEveryPath } from "@/lib/platform/surfaceHref";

function requestHost(req: NextRequest): string {
  const raw = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "";
  // A string split always yields at least one element; the default never applies.
  const [hostWithoutPort = ""] = raw.split(":");
  return hostWithoutPort.trim().toLowerCase();
}

export function isPersonalHost(req: NextRequest): boolean {
  return hostIsPersonal(requestHost(req));
}

/**
 * Hosts where the personal prefixes stay reachable by path.
 *
 * The subdomain can only ever point at production, so on localhost and on a
 * preview deployment there is no personal host to be on — and a rule that sent
 * the prefixes away everywhere else would make the shelf and the builder the
 * two parts of the app that cannot be opened before they ship.
 */
export function allowsPersonalPath(req: NextRequest): boolean {
  return servesEveryPath(requestHost(req));
}

export function rewritePersonalHostRequest(req: NextRequest): NextResponse | null {
  const { pathname } = req.nextUrl;

  if (!isPersonalHost(req)) {
    if (!isPersonalPath(pathname)) return null;
    if (allowsPersonalPath(req)) return NextResponse.next();

    // Forwarded, never 404'd: see "EVERY PERSONAL PATH" above. Folded to the
    // short form in the same hop, so a lesson is one redirect from its page
    // and not two.
    const target = new URL(personalUrl(canonicalPersonalPath(pathname)));
    target.search = req.nextUrl.search;
    return NextResponse.redirect(target, 308);
  }

  // The route prefix is not an address on this host. It forwards rather than
  // serving a duplicate, because a rewrite here would give every lesson two
  // URLs — and the one with the prefix is the one already written into the
  // codebase, so it is the one that would leak into a shared link.
  if (pathname === LEARNING_PATH_PREFIX || pathname.startsWith(`${LEARNING_PATH_PREFIX}/`)) {
    const target = new URL(personalUrl(canonicalPersonalPath(pathname)));
    target.search = req.nextUrl.search;
    return NextResponse.redirect(target, 308);
  }

  // A public page, reached on the wrong origin. Forwarded rather than resolved
  // as a course, which is what an unclaimed path means here.
  if (isPublicRootPath(pathname)) {
    const target = new URL(`${PLATFORM_ORIGIN}${pathname}`);
    target.search = req.nextUrl.search;
    return NextResponse.redirect(target, 308);
  }

  const route = personalRouteFor(pathname);
  if (route === pathname) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = route;
  return NextResponse.rewrite(url);
}
