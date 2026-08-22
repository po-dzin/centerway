/**
 * Where a path actually lives, seen from the host you are on.
 *
 * CenterWay runs on two public origins now: `www` is PUBLIC — anonymous,
 * indexable, cacheable — and `my` is PERSONAL — the shelf, the player, the
 * builder, all behind a session. A link that crosses that line has to name its
 * origin, and a link that does not cross it must stay relative, or every
 * in-app navigation turns into a full page load.
 *
 * PURE, and the host is an argument. Two copies of "which origin owns this
 * path" is how a menu comes to offer a link the router then redirects.
 */

import { hostBrandFromHost } from "@/lib/hostBrand";
import {
  PERSONAL_HOST,
  canonicalPersonalPath,
  isPersonalPath,
  personalUrl,
  platformUrl,
} from "@/lib/surfaces/catalog";

export function normalizeHost(rawHost: string | null | undefined): string {
  if (!rawHost) return "";
  return rawHost.split(":")[0].trim().toLowerCase();
}

/** The personal host, and the `www.` form the proxy folds into it. */
export function isPersonalHost(rawHost: string | null | undefined): boolean {
  const host = normalizeHost(rawHost);
  return host === PERSONAL_HOST || host === `www.${PERSONAL_HOST}`;
}

/**
 * Hosts where BOTH families are reachable by path.
 *
 * A subdomain can only ever point at production, so on localhost and on a
 * preview deployment there is no personal host to be on — and absolutising
 * those links there would send a developer testing the shelf to the live site.
 * These hosts are not public surfaces, so serving both prefixes costs nothing.
 */
export function servesEveryPath(rawHost: string | null | undefined): boolean {
  const host = normalizeHost(rawHost);
  return host === "localhost" || host === "127.0.0.1" || host.endsWith(".vercel.app");
}

/**
 * Absolute when the link leaves this origin, relative when it does not.
 *
 * Already-absolute input passes through: call sites hand this both kinds.
 */
export function resolveSurfaceHref(path: string, rawHost: string | null | undefined): string {
  if (/^https?:\/\//i.test(path)) return path;
  if (servesEveryPath(rawHost)) return path;

  const host = normalizeHost(rawHost);
  const onPersonal = isPersonalHost(host);

  if (isPersonalPath(path)) {
    // Folded to the dashboard's canonical form first: on this host `/learn` is
    // a 308 in front of `/`, and a link should name the destination.
    const personal = canonicalPersonalPath(path);
    return onPersonal ? personal : personalUrl(personal);
  }

  // A public path seen from the personal host, or from one of the funnel
  // hosts, has to name the platform. Those funnel hosts are served by this same
  // app through the proxy, so a relative link there resolves to a landing 404.
  if (onPersonal || hostBrandFromHost(host)) {
    return platformUrl(path);
  }
  return path;
}
