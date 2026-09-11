import { NextRequest, NextResponse } from "next/server";
import { isInfraBypassPath, shouldBypassProxy } from "@/lib/proxy/bypass";
import { resolveExperimentAssignmentRouteForRequest, withExperimentAssignmentNext } from "@/lib/proxy/experiments";
import { rewritePersonalHostRequest } from "@/lib/proxy/personal";
import { rewriteFunnelHostRequest, rewriteLegacyLandingEntryRequest } from "@/lib/proxy/landing";
import { PERSONAL_HOST } from "@/lib/surfaces/catalog";

const RETIRED_FUNNEL_HOST_REDIRECTS: Record<string, string> = {
  "detox.centerway.net.ua": "https://way21.centerway.net.ua/",
  "www.detox.centerway.net.ua": "https://way21.centerway.net.ua/",
};

/* Hosts that own their bare form: `www.<host>` 308s to it. The personal host is
   in the set for the same reason the funnels are, and for one more — its own
   rule ACCEPTS `www.my`, so without the redirect the "one canonical origin"
   this whole design turns on would be two. */
const CANONICAL_FUNNEL_HOSTS = new Set([
  "consult.centerway.net.ua",
  "dosha.centerway.net.ua",
  "herbs.centerway.net.ua",
  "irem.centerway.net.ua",
  "reboot.centerway.net.ua",
  "resetday.centerway.net.ua",
  "way21.centerway.net.ua",
  PERSONAL_HOST,
]);

/**
 * The platform's own pair. Canonical is `www`, and not by preference: the
 * sitemap, robots, the OG metadataBase and WFP_MERCHANT_DOMAIN all already name
 * it, and a payment provider's registered merchant domain is not a thing to
 * change for tidiness.
 *
 * Note the direction is the OPPOSITE of the funnel hosts above, which are
 * canonical bare. That asymmetry is inherited, not chosen, and it is why the
 * apex is matched exactly rather than folded into the www→bare rule.
 */
const PLATFORM_APEX_HOST = "centerway.net.ua";
const PLATFORM_CANONICAL_HOST = `www.${PLATFORM_APEX_HOST}`;

function retiredHostRedirect(req: NextRequest): NextResponse | null {
  const rawHost = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "";
  // A string split always yields at least one element; the default never applies.
  const [hostWithoutPort = ""] = rawHost.split(":");
  const host = hostWithoutPort.trim().toLowerCase();

  // Exact match only: every funnel host ends in this domain and must not be
  // dragged to www.
  if (host === PLATFORM_APEX_HOST) {
    const url = req.nextUrl.clone();
    url.host = PLATFORM_CANONICAL_HOST;
    return NextResponse.redirect(url, 308);
  }

  if (host.startsWith("www.")) {
    const bareHost = host.slice(4);
    if (CANONICAL_FUNNEL_HOSTS.has(bareHost)) {
      const url = req.nextUrl.clone();
      url.host = bareHost;
      return NextResponse.redirect(url, 308);
    }
  }

  const target = RETIRED_FUNNEL_HOST_REDIRECTS[host];
  return target ? NextResponse.redirect(new URL(target), 308) : null;
}

export function proxy(req: NextRequest) {
  const retired = retiredHostRedirect(req);
  if (retired) {
    return retired;
  }

  const { pathname } = req.nextUrl;

  // Framework, API and asset paths first, on every host. Nothing routes ahead
  // of these.
  if (isInfraBypassPath(pathname)) {
    return NextResponse.next();
  }

  // The personal host BEFORE the landing-bundle bypass, not after.
  //
  // That bypass matches by first segment — `/way21/`, `/reset-day/` — and those
  // are product slugs, which are also COURSE slugs. Personal routes now carry
  // their own prefix, so the collision is no longer literal, but the ordering
  // still is: the personal host must decide what it serves before a static
  // landing bundle claims a path on it.
  const personalResponse = rewritePersonalHostRequest(req);
  if (personalResponse) {
    return personalResponse;
  }

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

/**
 * WHAT THE PROXY IS ALLOWED TO SEE, and the cheapest request is the one that
 * never reaches it.
 *
 * Every path this matcher admits invokes a function — including the ones whose
 * only outcome is `isInfraBypassPath` returning true and the proxy answering
 * `NextResponse.next()`. That is a billed invocation and a cold-path CPU slice
 * spent to decide to do nothing, and it was being spent on static bytes:
 * measured 2026-09-10, a platform page pulls ~26 assets that the old matcher
 * admitted (11 woff2, the `/cw/` icon sprite, brand mark and hero art, the
 * worker and the manifest), against ~4 that actually need routing.
 *
 * So the file roots under `public/` are excluded here as well as bypassed in
 * `isInfraBypassPath`. THE TWO ARE NOT REDUNDANT: this list decides whether the
 * function runs, the bypass decides what it does once it has. Keeping both means
 * narrowing one can never turn a static asset into a brand-resolution 404 again
 * — which is the failure `/fonts/` was living in until today.
 *
 * `_next/static` and `_next/image` were already here and stay. `/shared/` is
 * deliberately NOT here: it is a landing-bundle path, not a `public/` root, and
 * its first segment is also a brand name. Neither is `/api/`: it is bypassed
 * too, but only AFTER the canonical-host redirect, and taking it out of the
 * matcher would serve API calls on the apex instead of forwarding them.
 */
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|sitemap\.xml|robots\.txt|fonts/|cw/|sw\.js|offline\.html|favicon\.ico|manifest\.webmanifest|icon\.svg|apple-icon\.png).*)",
  ],
};
