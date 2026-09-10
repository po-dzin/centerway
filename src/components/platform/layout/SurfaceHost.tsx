"use client";

/**
 * Which origin this page is on, for the links that have to know.
 *
 * NO LONGER READ FROM THE REQUEST. The Host header was read once in the root
 * layout and handed down here, and that one `headers()` call made every page
 * under (platform) dynamic. The host answered two questions, and neither needs
 * the request:
 *
 *   1. Is there one origin or two? A deployment fact — see
 *      `NEXT_PUBLIC_CW_SINGLE_HOST` in next.config.ts.
 *   2. Am I on the personal surface or the public one? A path fact in
 *      production: `my` serves the shelf, the player and the builder and
 *      forwards everything else to `www`; `www` 404s the personal prefixes.
 *      The shell already carries the answer as `PlatformLayout`'s `surface`
 *      prop, so it PROVIDES a synthetic host — `my.…` for a personal page,
 *      `www.…` otherwise — and every consumer below it resolves against that.
 *
 * The one case the path cannot answer is a FUNNEL HOST: `dosha.centerway.net.ua`
 * serves a platform page through the proxy, and there a public link must name
 * `www` or it 404s on the funnel. That host is only knowable in the browser,
 * so it is applied after mount — the server markup is rendered as if on `www`,
 * hydration matches it, and the effect then re-resolves the links. A brief
 * relative href on a funnel host is the price of a static page everywhere.
 *
 * The context fallback exists for surfaces that render outside a shell — a
 * test, a component mounted on its own — and is the browser's own host.
 */

import { createContext, useContext, useMemo, useSyncExternalStore, type ReactNode } from "react";

import { hostBrandFromHost } from "@/lib/surfaces/hostBrand";
import { isPersonalHost, resolveSurfaceHref, servesEveryPath } from "@/lib/platform/surfaceHref";
import { PERSONAL_HOST, PLATFORM_ORIGIN } from "@/lib/surfaces/catalog";

const PLATFORM_HOST = new URL(PLATFORM_ORIGIN).host;

/** True on localhost and on a preview deployment: one origin serves every path. */
export const SINGLE_HOST_DEPLOYMENT = process.env.NEXT_PUBLIC_CW_SINGLE_HOST === "1";

/**
 * The host a page is on, derived from what the page declared about itself.
 * On a single-host deployment it is `localhost`, which `servesEveryPath`
 * recognises and which keeps every link relative there.
 */
export function syntheticHost(surface: "personal" | "public"): string {
  if (SINGLE_HOST_DEPLOYMENT) return "localhost";
  return surface === "personal" ? PERSONAL_HOST : PLATFORM_HOST;
}

const SurfaceHostContext = createContext<string | null>(null);

export function SurfaceHostProvider({ host, children }: { host: string | null; children: ReactNode }) {
  return <SurfaceHostContext.Provider value={host}>{children}</SurfaceHostContext.Provider>;
}

/**
 * The browser's host, null during SSR and the hydrating render.
 *
 * `useSyncExternalStore` rather than an effect that sets state: React renders
 * the server snapshot (null) while hydrating, so the markup matches, and then
 * re-renders with the client snapshot on its own. The host never changes for
 * the life of a page, so there is nothing to subscribe to.
 */
const noSubscription = () => () => {};
function useRuntimeHost(): string | null {
  return useSyncExternalStore(noSubscription, () => window.location.host, () => null);
}

export function useSurfaceHost(): string | null {
  const provided = useContext(SurfaceHostContext);
  const runtime = useRuntimeHost();
  // A funnel host is the one thing the shell cannot declare; the browser can.
  if (runtime && hostBrandFromHost(runtime)) return runtime;
  if (provided) return provided;
  return runtime;
}

/**
 * One resolver for a whole component's links.
 *
 * A FUNCTION rather than a hook per link: the nav renders its items in a `map`,
 * where a hook cannot be called, and one state cell per link would be the
 * alternative.
 */
export function useSurfaceHref(): (path: string) => string {
  const host = useSurfaceHost();
  return useMemo(() => (path: string) => resolveSurfaceHref(path, host), [host]);
}

/**
 * True where THIS origin serves the personal surfaces — `my` in production, and
 * every host in development, where there is only one.
 *
 * Asked by anything that ACTS on the origin rather than linking across it. The
 * install offer is the case that matters: an install is bound to the origin
 * that offered it, so on `www` it would put the storefront on a home screen.
 */
export function useOwnsPersonalSurfaces(): boolean {
  const host = useSurfaceHost();
  return isPersonalHost(host) || servesEveryPath(host);
}
