import { NextRequest, NextResponse } from "next/server";
import { normalizeLandingPathname } from "@/lib/landing/routing";
import { shouldBypassProxy } from "@/lib/proxy/bypass";
import { nextWithExperimentContext, resolveExperimentRoute } from "@/lib/proxy/experiments";
import { maybeHandleLandingEntry, maybeRewriteLandingRequest } from "@/lib/proxy/landing";

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const normalizedPathname = normalizeLandingPathname(pathname);

  const experimentRoute = resolveExperimentRoute(normalizedPathname);
  if (experimentRoute) {
    return nextWithExperimentContext(req, experimentRoute);
  }

  if (shouldBypassProxy(pathname)) {
    return NextResponse.next();
  }

  const landingEntryResponse = maybeHandleLandingEntry(req);
  if (landingEntryResponse) {
    return landingEntryResponse;
  }

  const landingRewriteResponse = maybeRewriteLandingRequest(req);
  if (landingRewriteResponse) {
    return landingRewriteResponse;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|sitemap.xml|robots.txt|v1/).*)"],
};
