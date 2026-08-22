"use client";

/**
 * The request's host, handed down from the server layout.
 *
 * WHY A CONTEXT AND NOT `window.location`. Which origin owns a path depends on
 * the host, and the host is knowable on the server — but only in a server
 * component. Reading it from `window` means the first render disagrees with the
 * markup that was sent, and every link on the page hydrates with a different
 * `href` than it was rendered with. That is fine for a control that only ever
 * appears after a session read (the shelf's cards); it is not fine for the
 * player, which is server-rendered with its whole navigation in place.
 *
 * The fallback exists for surfaces that render outside a provider — a test, a
 * component mounted on its own — and is the browser's own host, which is the
 * right answer everywhere except during SSR, where there is nothing better.
 */

import { createContext, useContext, useMemo, type ReactNode } from "react";

import { isPersonalHost, resolveSurfaceHref, servesEveryPath } from "@/lib/platform/surfaceHref";

const SurfaceHostContext = createContext<string | null>(null);

export function SurfaceHostProvider({ host, children }: { host: string | null; children: ReactNode }) {
  return <SurfaceHostContext.Provider value={host}>{children}</SurfaceHostContext.Provider>;
}

export function useSurfaceHost(): string | null {
  const provided = useContext(SurfaceHostContext);
  if (provided) return provided;
  return typeof window === "undefined" ? null : window.location.host;
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
