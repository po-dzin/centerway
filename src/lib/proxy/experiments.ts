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
import { resolveRequestBrand } from "@/lib/proxy/requestBrand";
import { getProductSurfaceEntry } from "@/lib/surfaces/catalog";

const EXPERIMENT_COOKIE_MAX_AGE = 60 * 60 * 24 * 90;

type ExperimentAssignmentContext = {
  requestHeaders: Headers;
  cookieMutations: Array<{ name: string; value: string }>;
  themeFromQuery: string | null;
};

export function resolveExperimentAssignmentRoute(): ScreenRouteKey | null {
  return null;
}

export function resolveExperimentAssignmentRouteForRequest(req: NextRequest): ScreenRouteKey | null {
  const directRoute = resolveExperimentAssignmentRoute();
  if (directRoute) {
    return directRoute;
  }

  if (req.nextUrl.pathname !== "/" && req.nextUrl.pathname !== "/index.html") {
    return null;
  }

  const product = resolveRequestBrand(req);
  if (!product) {
    return null;
  }

  const entry = getProductSurfaceEntry(product);
  if (entry.funnelRuntime !== "generated-app" || !entry.internalFunnelRoute) {
    return null;
  }

  return resolveExperimentAssignmentRoute();
}

function buildExperimentAssignmentContext(req: NextRequest, routeKey: ScreenRouteKey): ExperimentAssignmentContext {
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

  return {
    requestHeaders,
    cookieMutations: resolved.cookieMutations,
    themeFromQuery,
  };
}

function applyExperimentAssignmentCookies(req: NextRequest, res: NextResponse, context: ExperimentAssignmentContext): NextResponse {
  const secure = req.nextUrl.protocol === "https:";
  for (const mutation of context.cookieMutations) {
    res.cookies.set(mutation.name, mutation.value, {
      path: "/",
      maxAge: EXPERIMENT_COOKIE_MAX_AGE,
      sameSite: "lax",
      secure,
      httpOnly: true,
    });
  }
  if (context.themeFromQuery) {
    res.cookies.set(CW_THEME_COOKIE, context.themeFromQuery, {
      path: "/",
      maxAge: EXPERIMENT_COOKIE_MAX_AGE,
      sameSite: "lax",
      secure,
      httpOnly: false,
    });
  }

  return res;
}

function mergeRequestHeaders(base: Headers, extraHeaders?: HeadersInit): Headers {
  const merged = new Headers(base);
  if (!extraHeaders) {
    return merged;
  }

  const extra = new Headers(extraHeaders);
  extra.forEach((value, key) => {
    merged.set(key, value);
  });
  return merged;
}

export function withExperimentAssignmentNext(req: NextRequest, routeKey: ScreenRouteKey): NextResponse {
  const context = buildExperimentAssignmentContext(req, routeKey);
  const res = NextResponse.next({
    request: {
      headers: context.requestHeaders,
    },
  });

  return applyExperimentAssignmentCookies(req, res, context);
}

export function withExperimentAssignmentRewrite(
  req: NextRequest,
  pathname: string,
  routeKey: ScreenRouteKey,
  extraRequestHeaders?: HeadersInit
): NextResponse {
  const context = buildExperimentAssignmentContext(req, routeKey);
  const url = req.nextUrl.clone();
  url.pathname = pathname;

  const res = NextResponse.rewrite(url, {
    request: {
      headers: mergeRequestHeaders(context.requestHeaders, extraRequestHeaders),
    },
  });

  return applyExperimentAssignmentCookies(req, res, context);
}
