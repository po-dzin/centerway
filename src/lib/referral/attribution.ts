import type { NextRequest, NextResponse } from "next/server";

import {
  REF_COOKIE,
  REF_COOKIE_MAX_AGE_SECONDS,
  keepRef,
  normalizeRef,
  refFromSearch,
  utmFromSearch,
  type UtmSet,
} from "./ref";

/**
 * HOW A LANDING'S QUERY STRING SURVIVES UNTIL SOMETHING IS WRITTEN.
 *
 * A friend's link is `…/way21?ref=olena`; the row it should mark is written
 * minutes or days later, on another host (`my.`), by a request that no longer
 * carries that query. Same for UTM on the platform's own offer pages: the ad
 * lands on `/programs/way21?utm_campaign=…`, the buyer reads, and the pay link
 * they finally press has no UTM on it — so `orders.campaign` stayed empty for
 * every sale that did not start on a static landing.
 *
 * Two first-party cookies on the parent domain carry them across:
 *   `cw_ref` — FIRST touch, 90 days. Whoever brought the person keeps them.
 *   `cw_utm` — LAST touch, 30 days. The ad that was clicked most recently is
 *              the one the sale is reported against, as Meta itself does.
 *
 * Neither holds anything about the person: a tag somebody else chose, and the
 * campaign labels that were already in the address bar.
 */

export const UTM_COOKIE = "cw_utm";
const UTM_COOKIE_MAX_AGE_SECONDS = 30 * 24 * 3600;
const PARENT_DOMAIN = "centerway.net.ua";

export type Attribution = { ref: string | null; utm: UtmSet | null };

function parseUtmCookie(value: string | undefined): UtmSet | null {
  // Round-trips through the same reader a URL goes through, so a hand-edited
  // cookie can carry nothing a query string could not. The cookie API does the
  // percent-encoding on both sides; the value here is a plain query string.
  return value ? utmFromSearch(new URLSearchParams(value)) : null;
}

function serializeUtm(utm: UtmSet): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(utm)) params.set(`utm_${key}`, value);
  return params.toString();
}

/** What this request knows about where the person came from: the URL first, then the cookies. */
export function readAttribution(req: NextRequest): Attribution {
  const params = req.nextUrl.searchParams;
  return {
    ref: keepRef(req.cookies.get(REF_COOKIE)?.value, refFromSearch(params)),
    utm: utmFromSearch(params) ?? parseUtmCookie(req.cookies.get(UTM_COOKIE)?.value),
  };
}

function cookieDomain(req: NextRequest): string | undefined {
  const host =
    (req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "").split(":")[0]?.toLowerCase() ?? "";
  // The parent domain in production so `www.`, `my.` and the funnel hosts share
  // it; host-only on localhost and previews, where a Domain would be rejected.
  return host === PARENT_DOMAIN || host.endsWith(`.${PARENT_DOMAIN}`) ? `.${PARENT_DOMAIN}` : undefined;
}

/**
 * Writes the cookies onto a response the proxy is about to return. Touches
 * nothing unless the URL actually carried a tag or a UTM set, so the common
 * request stays free of `Set-Cookie`.
 */
export function rememberAttribution<R extends NextResponse>(req: NextRequest, res: R): R {
  const params = req.nextUrl.searchParams;
  const domain = cookieDomain(req);
  const base = { path: "/", sameSite: "lax" as const, secure: domain !== undefined, ...(domain ? { domain } : {}) };

  const arrivedRef = refFromSearch(params);
  if (arrivedRef && !normalizeRef(req.cookies.get(REF_COOKIE)?.value)) {
    res.cookies.set(REF_COOKIE, arrivedRef, { ...base, maxAge: REF_COOKIE_MAX_AGE_SECONDS });
  }

  const arrivedUtm = utmFromSearch(params);
  if (arrivedUtm) {
    res.cookies.set(UTM_COOKIE, serializeUtm(arrivedUtm), { ...base, maxAge: UTM_COOKIE_MAX_AGE_SECONDS });
  }
  return res;
}
