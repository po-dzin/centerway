import { LANDING_STATIC_BRANDS } from "@/lib/landing/contracts";

// "/cw/" and "/shared/" are platform asset roots served straight from static output.
// They must never enter brand resolution: an asset request carries the embedding page
// as its referer, so a page whose path maps to a funnel brand (/consult, /dosha-test,
// /tests/dosha) turned its own images into disabled-surface 404s.
const INFRA_BYPASS_PREFIXES = [
  "/api/",
  "/v1/",
  "/_next/",
  "/_vercel/",
  "/pay/return",
  "/go/",
  "/cw/",
  "/shared/",
] as const;

const LANDING_BRAND_PREFIXES = Array.from(LANDING_STATIC_BRANDS, (brand) => `/${brand}/`);

/* The app's own root-level metadata files. They are generated routes, not
   pages, and they must answer on EVERY host — the personal host sends unknown
   paths to `www`, and without this its manifest and icons would be sent along
   with them, which is an installed app that cannot find its own identity. */
const BYPASS_EXACT_PATHS = new Set([
  "/favicon.ico",
  "/manifest.webmanifest",
  "/icon.svg",
  "/apple-icon.png",
  /* The worker and the document it precaches. A service worker registration
     dies on a cross-origin redirect, and without a worker that answers a
     navigation offline Chrome does not offer installation at all — so sending
     these to `www` from the personal host would silently un-installable the one
     host the app is meant to be installed from. */
  "/sw.js",
  "/offline.html",
]);

/**
 * Framework, API and asset paths. Host-independent: these bypass everywhere,
 * on every host, and nothing may be routed ahead of them.
 */
export function isInfraBypassPath(pathname: string): boolean {
  if (BYPASS_EXACT_PATHS.has(pathname)) return true;
  return INFRA_BYPASS_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

/**
 * Paths owned by a static landing bundle, by first segment: `/way21/...`,
 * `/irem/...`, `/shared/...`.
 *
 * Host-DEPENDENT in effect, and that distinction is load-bearing. These names
 * are product slugs, and a course carries its product's slug — so on the
 * builder host `/way21/intro` is a LESSON, not a landing asset. Bypassing it
 * there 404s every lesson-editor URL the builder has, which is exactly what
 * shipped: `/way21` resolved (the prefixes carry a trailing slash) and
 * `/way21/intro` did not.
 */
export function isLandingBundlePath(pathname: string): boolean {
  return LANDING_BRAND_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export function shouldBypassProxy(pathname: string): boolean {
  return isInfraBypassPath(pathname) || isLandingBundlePath(pathname);
}
