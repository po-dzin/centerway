import { NextRequest, NextResponse } from "next/server";
import {
  CW_EXPERIMENT_ASSIGNMENTS_HEADER,
  encodeExperimentAssignmentsHeader,
  parseCookieHeader,
  resolveExperimentAssignments,
} from "@/lib/experiments/engine";
import { getExperiments } from "@/lib/generator/registry";
import {
  CW_THEME_COOKIE,
  CW_THEME_SELECTION_HEADER,
  getThemeFromSearchParams,
} from "@/lib/generator/theme";
import type { ScreenRouteKey } from "@/lib/generator/types";

const EXPERIMENT_COOKIE_MAX_AGE = 60 * 60 * 24 * 90;

export function resolveExperimentRoute(pathname: string): ScreenRouteKey | null {
  if (pathname === "/consult") return "consult";
  if (pathname === "/detox") return "detox";
  if (pathname === "/herbs") return "herbs";
  if (pathname === "/dosha-test") return "dosha-test";
  if (pathname === "/lesson/pilot") return "lesson-pilot";
  return null;
}

export function nextWithExperimentContext(req: NextRequest, routeKey: ScreenRouteKey): NextResponse {
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
