/**
 * WHERE A SIGN-IN PUTS THE PERSON BACK.
 *
 * The wall in front of `/learn` and `/profile` always knew: it renders in
 * place of the page that was asked for, so returning to `window.location.href`
 * returns to that page. The HEADER did not. «Увійти» there is a link to the
 * cabinet, so a reader who pressed it on a programme page, on the diagnostic,
 * or halfway down the catalogue signed in and arrived at their dashboard — the
 * page they were reading gone, and the only way back the browser's own button.
 *
 * So the crossing carries where it came from, as `?next=`, and this module is
 * the one place that decides whether a `next` may be honoured.
 *
 * TWO ORIGINS, WHICH IS WHY THIS IS NOT A ONE-LINE CHECK. The public site is
 * `www` and everything personal — the cabinet, the shelf, the door itself — is
 * `my`, so the return address genuinely does cross origins and «a path on this
 * host» is too narrow a rule: it would silently drop every return to the
 * public site, which is most of them.
 *
 * A sign-in page that takes its destination from the query string is the exact
 * shape of an open redirect, so the widening is exactly two named origins —
 * ours — plus whatever origin the reader is already on (localhost and preview
 * deployments, where both families are served by one host). Everything else is
 * refused and the cabinet is used instead. `//evil.example` and `/\evil.example`
 * are both rejected by resolving the candidate the way the browser will and
 * looking at the origin that comes out, never by reading the string.
 */

import { PERSONAL_ORIGIN, PLATFORM_ORIGIN, PROFILE_PATH_PREFIX } from "@/lib/surfaces/catalog";

/** The query key. One spelling, so a producer and a reader cannot drift. */
export const RETURN_PARAM = "next";

function allowedOrigins(currentOrigin: string): string[] {
  return [currentOrigin, PLATFORM_ORIGIN, PERSONAL_ORIGIN];
}

/**
 * The candidate as a destination, or null if it may not be followed.
 *
 * Same-origin answers come back RELATIVE, so a return inside one app stays a
 * client navigation; a crossing comes back absolute and its caller does a full
 * load, which is what a change of origin is.
 */
export function safeReturnTarget(raw: string | null | undefined, currentOrigin: string): string | null {
  if (!raw) return null;
  let target: URL;
  try {
    target = new URL(raw, currentOrigin);
  } catch {
    return null;
  }
  if (!allowedOrigins(currentOrigin).includes(target.origin)) return null;
  const path = `${target.pathname}${target.search}${target.hash}`;
  return target.origin === currentOrigin ? path : `${target.origin}${path}`;
}

/** The `next` the current address carries, already vetted. */
export function readReturnTarget(): string | null {
  if (typeof window === "undefined") return null;
  const raw = new URLSearchParams(window.location.search).get(RETURN_PARAM);
  return safeReturnTarget(raw, window.location.origin);
}

/** `readReturnTarget`, falling back to the cabinet — the door's own default. */
export function returnTargetOrCabinet(): string {
  return readReturnTarget() ?? PROFILE_PATH_PREFIX;
}

/**
 * The address to come back to from where the reader is standing now, or null
 * when there is nothing worth carrying.
 *
 * A `next` already in the address wins: the door hands the wall to the door
 * behind it (`/profile` → `/signin/email`) and the ORIGINAL destination must
 * survive both hops rather than each screen naming the one before it.
 *
 * Nothing is carried from a sign-in surface itself, and nothing from the
 * destination this would return to — a `next` pointing at the page that is
 * about to render is a redirect to nowhere, and one pointing back at the door
 * is a loop.
 */
export function returnTargetFromHere(options?: { ignorePrefixes?: string[] }): string | null {
  if (typeof window === "undefined") return null;
  const carried = readReturnTarget();
  if (carried) return carried;

  const { pathname, search, hash, origin } = window.location;
  /* The door and the cabinet name themselves. `/signin` would be a loop, and
     the cabinet is already where a sign-in lands — carrying it would put the
     default in the address bar and buy nothing. */
  const ignored = ["/signin", PROFILE_PATH_PREFIX, ...(options?.ignorePrefixes ?? [])];
  if (ignored.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) return null;

  const path = `${pathname}${search}${hash}`;
  /* Absolute when the door is on the other origin — the cabinet is on `my` and
     most of the pages that offer this link are on `www`, so the common case is
     a crossing and a relative path would resolve against the wrong host. */
  return `${origin}${path}`;
}

/** The `?next=…` suffix for a link to the door, or "" when there is nothing to carry. */
export function returnQuery(target: string | null): string {
  return target ? `?${RETURN_PARAM}=${encodeURIComponent(target)}` : "";
}

/**
 * Follow a vetted destination. Same-origin goes through the router; a crossing
 * is a location assign, because it is a different app.
 */
export function goToReturnTarget(target: string, replace: (path: string) => void): void {
  if (typeof window === "undefined") return;
  if (/^https?:\/\//i.test(target)) {
    window.location.replace(target);
    return;
  }
  replace(target);
}
