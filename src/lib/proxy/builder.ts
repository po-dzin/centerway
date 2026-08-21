/**
 * Maps the builder host onto the builder routes.
 *
 * Deliberately NOT part of the funnel-host machinery in ./landing.ts. That code
 * resolves a *product* from a host and then decides which landing surface to
 * serve; the builder is not a product and has no landing. It is one host, one
 * route prefix, one rule — and keeping it here means the funnel registry does
 * not grow a member that is not a funnel.
 *
 * Two directions, both required:
 *
 *   build.centerway.net.ua/anything  → /build/anything   (the host is the app)
 *   www.centerway.net.ua/build/...   → 404                (one canonical origin)
 *
 * The second matters as much as the first. Without it the builder would live at
 * two URLs, and the one on the platform origin would be the one search engines,
 * shared links and muscle memory found first — with the platform's own header
 * and footer around it.
 */

import { NextRequest, NextResponse } from "next/server";

import { BUILDER_HOST, BUILDER_PATH_PREFIX } from "@/lib/surfaces/catalog";

function requestHost(req: NextRequest): string {
  return (req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "")
    .split(":")[0]
    .trim()
    .toLowerCase();
}

export function isBuilderHost(req: NextRequest): boolean {
  const host = requestHost(req);
  return host === BUILDER_HOST || host === `www.${BUILDER_HOST}`;
}

/**
 * Hosts where /build stays reachable by path.
 *
 * The builder subdomain can only ever point at production, so on localhost and
 * on a preview deployment there is no builder host to be on — and a rule that
 * 404s the prefix everywhere else would make the builder the one part of the
 * app that cannot be opened before it ships. These hosts are not public
 * surfaces, so serving the prefix on them costs nothing.
 */
function allowsBuilderPath(req: NextRequest): boolean {
  const host = requestHost(req);
  return host === "localhost" || host === "127.0.0.1" || host.endsWith(".vercel.app");
}

export function rewriteBuilderHostRequest(req: NextRequest): NextResponse | null {
  const { pathname } = req.nextUrl;

  if (!isBuilderHost(req)) {
    // The prefix is not reachable from any other PUBLIC host, so the builder
    // has one canonical origin and cannot be found wearing the platform's own
    // chrome. Dev and preview hosts keep it, or it could never be opened before
    // the subdomain exists.
    if (pathname === BUILDER_PATH_PREFIX || pathname.startsWith(`${BUILDER_PATH_PREFIX}/`)) {
      return allowsBuilderPath(req) ? NextResponse.next() : new NextResponse(null, { status: 404 });
    }
    return null;
  }

  if (pathname === BUILDER_PATH_PREFIX || pathname.startsWith(`${BUILDER_PATH_PREFIX}/`)) {
    return NextResponse.next();
  }

  const url = req.nextUrl.clone();
  url.pathname = pathname === "/" ? BUILDER_PATH_PREFIX : `${BUILDER_PATH_PREFIX}${pathname}`;
  return NextResponse.rewrite(url);
}
