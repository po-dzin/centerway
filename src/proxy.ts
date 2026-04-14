import { NextRequest, NextResponse } from "next/server";
import { HostBrand, hostBrandFromHost } from "@/lib/hostBrand";
import {
  CW_EXPERIMENT_ASSIGNMENTS_HEADER,
  encodeExperimentAssignmentsHeader,
  parseCookieHeader,
  resolveExperimentAssignments,
} from "@/lib/experiments/engine";
import { getExperiments } from "@/lib/generator/registry";
import type { ScreenRouteKey } from "@/lib/generator/types";
import {
  CW_THEME_COOKIE,
  CW_THEME_SELECTION_HEADER,
  getThemeFromSearchParams,
} from "@/lib/generator/theme";

const ROOT_PAGE_MAP: Record<string, string> = {
  "/": "/index.html",
  "/index.html": "/index.html",
  "/index2.html": "/index2.html",
  "/public-offer.html": "/public-offer.html",
  "/thanks": "/thanks.html",
  "/thanks.html": "/thanks.html",
  "/pay-failed": "/pay-failed.html",
  "/pay-failed.html": "/pay-failed.html",
};

const LANDING_ASSET_PREFIXES = ["/css/", "/js/", "/img/", "/fonts/", "/libs/"];
const LANDING_ROOT_FILES = new Set(["/main-short.css", "/media-short.css", "/Frame"]);
const EXPERIMENT_COOKIE_MAX_AGE = 60 * 60 * 24 * 90;

function brandFromReferer(rawReferer: string | null): HostBrand | null {
  if (!rawReferer) return null;
  try {
    const ref = new URL(rawReferer);
    const p = ref.pathname.toLowerCase();
    if (p === "/irem" || p.startsWith("/irem/")) return "irem";
    if (p === "/reboot" || p.startsWith("/reboot/")) return "short";
    if (p === "/consult" || p.startsWith("/consult/")) return "consult";
    if (p === "/detox" || p.startsWith("/detox/")) return "detox";
    if (p === "/herbs" || p.startsWith("/herbs/")) return "herbs";
  } catch {
    return null;
  }
  return null;
}

function resolveRequestBrand(req: NextRequest): HostBrand | null {
  const byReferer = brandFromReferer(req.headers.get("referer"));
  if (byReferer) return byReferer;

  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  return hostBrandFromHost(host);
}

function rewriteLanding(req: NextRequest, landingPath: string) {
  const brand = resolveRequestBrand(req);
  if (!brand) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = `/${brand}${landingPath}`;
  return NextResponse.rewrite(url);
}

function experimentRouteFromPathname(pathname: string): ScreenRouteKey | null {
  if (pathname === "/consult") return "consult";
  if (pathname === "/detox") return "detox";
  if (pathname === "/herbs") return "herbs";
  if (pathname === "/dosha-test") return "dosha-test";
  if (pathname === "/lesson/pilot") return "lesson-pilot";
  return null;
}

function normalizePathname(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }
  return pathname;
}

function nextWithExperimentContext(req: NextRequest, routeKey: ScreenRouteKey): NextResponse {
  const cookies = parseCookieHeader(req.headers.get("cookie"));
  const themeFromQuery = getThemeFromSearchParams(req.nextUrl.searchParams);
  const themeFromCookie = cookies.get(CW_THEME_COOKIE)?.trim() || null;
  const resolvedThemeSelection = themeFromQuery ?? themeFromCookie;
  const resolved = resolveExperimentAssignments({
    routeKey,
    experiments: getExperiments(),
    searchParams: req.nextUrl.searchParams,
    cookies,
  });

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set(CW_EXPERIMENT_ASSIGNMENTS_HEADER, encodeExperimentAssignmentsHeader(resolved.assignments));
  if (resolvedThemeSelection) {
    requestHeaders.set(CW_THEME_SELECTION_HEADER, resolvedThemeSelection);
  }

  const res = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  const secure = req.nextUrl.protocol === "https:";
  for (const mutation of resolved.cookieMutations) {
    res.cookies.set(mutation.name, mutation.value, {
      path: "/",
      maxAge: EXPERIMENT_COOKIE_MAX_AGE,
      sameSite: "lax",
      secure,
      httpOnly: true,
    });
  }
  if (themeFromQuery) {
    res.cookies.set(CW_THEME_COOKIE, themeFromQuery, {
      path: "/",
      maxAge: EXPERIMENT_COOKIE_MAX_AGE,
      sameSite: "lax",
      secure,
      httpOnly: false,
    });
  }

  return res;
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const normalizedPathname = normalizePathname(pathname);

  // External pollers hit these paths very frequently in dev.
  // Respond directly from proxy to avoid touching app route compilation.
  if (pathname === "/v1/me/balance") {
    return NextResponse.json(
      { balance: 0, currency: "UAH" },
      { status: 200, headers: { "Cache-Control": "public, max-age=300, s-maxage=300" } }
    );
  }
  if (pathname === "/v1/me/photos") {
    return NextResponse.json(
      { photos: [] },
      { status: 200, headers: { "Cache-Control": "public, max-age=300, s-maxage=300" } }
    );
  }

  const experimentRoute = experimentRouteFromPathname(normalizedPathname);
  if (experimentRoute) {
    return nextWithExperimentContext(req, experimentRoute);
  }

  // Backend/runtime routes should stay untouched.
  if (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/v1/") ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/pay/return") ||
    pathname.startsWith("/short/") ||
    pathname.startsWith("/irem/") ||
    pathname.startsWith("/consult/") ||
    pathname.startsWith("/detox/") ||
    pathname.startsWith("/herbs/") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  // Local convenience routes for static legacy landing pages:
  // - /reboot -> /short/index.html
  // - /irem   -> /irem/index.html
  // /consult, /detox, /herbs are Next app routes.
  if (pathname === "/reboot" || pathname === "/reboot/") {
    const url = req.nextUrl.clone();
    url.pathname = "/short/index.html";
    return NextResponse.rewrite(url);
  }

  if (pathname === "/irem" || pathname === "/irem/") {
    const url = req.nextUrl.clone();
    url.pathname = "/irem/index.html";
    return NextResponse.rewrite(url);
  }

  const mappedPage = ROOT_PAGE_MAP[pathname];
  if (mappedPage) {
    return rewriteLanding(req, mappedPage);
  }

  if (LANDING_ASSET_PREFIXES.some((p) => pathname.startsWith(p))) {
    return rewriteLanding(req, pathname);
  }

  if (LANDING_ROOT_FILES.has(pathname)) {
    return rewriteLanding(req, pathname);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|sitemap.xml|robots.txt|v1/).*)"],
};
