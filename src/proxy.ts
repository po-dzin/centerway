import { NextRequest, NextResponse } from "next/server";
import { shouldBypassProxy } from "@/lib/proxy/bypass";
import { resolveExperimentAssignmentRouteForRequest, withExperimentAssignmentNext } from "@/lib/proxy/experiments";
import { rewriteFunnelHostRequest, rewriteLegacyLandingEntryRequest } from "@/lib/proxy/landing";

const RETIRED_FUNNEL_HOST_REDIRECTS: Record<string, string> = {
  // The detox funnel moved to the way21.centerway.net.ua landing.
  "detox.centerway.net.ua": "https://way21.centerway.net.ua/",
  "www.detox.centerway.net.ua": "https://way21.centerway.net.ua/",
};

function retiredHostRedirect(req: NextRequest): NextResponse | null {
  const host = (req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "")
    .split(":")[0]
    .trim()
    .toLowerCase();
  const target = RETIRED_FUNNEL_HOST_REDIRECTS[host];
  return target ? NextResponse.redirect(new URL(target), 308) : null;
}

export function proxy(req: NextRequest) {
  const retired = retiredHostRedirect(req);
  if (retired) {
    return retired;
  }

  const { pathname } = req.nextUrl;

  if (shouldBypassProxy(pathname)) {
    return NextResponse.next();
  }

  const landingEntryResponse = rewriteLegacyLandingEntryRequest(req);
  if (landingEntryResponse) {
    return landingEntryResponse;
  }

  const landingRewriteResponse = rewriteFunnelHostRequest(req);
  if (landingRewriteResponse) {
    return landingRewriteResponse;
  }

  const experimentRoute = resolveExperimentAssignmentRouteForRequest(req);
  if (experimentRoute) {
    return withExperimentAssignmentNext(req, experimentRoute);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|sitemap.xml|robots.txt|v1/).*)"],
};
