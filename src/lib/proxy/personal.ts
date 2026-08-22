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
 *   my.centerway.net.ua/build/…     → /build/…               the builder
 *   my.centerway.net.ua/learn…      → 308 to the short form  it is not an address
 *   www.centerway.net.ua/learn…     → 404                    personal, only here
 *   www.centerway.net.ua/build/…    → 404                    same rule, same reason
 *
 * The tree is the point. A dashboard at the root with lessons under `/learn/…`
 * meant children whose parent redirected away — so the prefix stopped being an
 * address and went back to being what it is: the route the pages live at.
 *
 * Both prefixes 404 on every public host, with no forward for either. A
 * redirect would keep a second, older address alive and discoverable, which is
 * what "one canonical origin" exists to prevent. The cost is stated where it
 * lands: links printed before the move — messages the support bot has already
 * sent, reminders already queued, an app installed off the old `start_url` —
 * arrive at a 404 rather than at the dashboard.
 *
 * On the personal host an unclaimed path is a COURSE, so the public top-level
 * segments (`/profile`, `/legal/…`, `/programs`) forward to `www` instead of
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
  return (req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "")
    .split(":")[0]
    .trim()
    .toLowerCase();
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

    // Personal, and only here. No forward for either prefix.
    return new NextResponse(null, { status: 404 });
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
