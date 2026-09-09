"use client";

import { useEffect } from "react";

/**
 * THE PAGE THAT COMES BACK IS NOT A NEW PAGE.
 *
 * `(platform)/layout.tsx` reads `headers()` on every request, which makes
 * every route under it dynamic — and Next's default response for a dynamic
 * App Router page carries `Cache-Control: private, no-store`. Firefox and
 * Safari treat that as "never keep this in the back/forward cache," so
 * pressing Back after leaving the platform does a fresh navigation there.
 * Chrome does not: since ~M108 it ignores `no-store` for bfcache eligibility,
 * so the SAME frozen tab — the same JS heap, the same in-flight timers, the
 * same Supabase session object read once at mount — is thawed and repainted
 * instead of reloaded.
 *
 * That is fine for a page built to expect it. This one was not: the route
 * transition in `routeTransition.ts` keeps its own module-scope timer and
 * resolver rather than React state, `usePlatformSession` subscribes to auth
 * once on mount and never again, and nothing in the tree has an error
 * boundary (see `error.tsx` beside this file's nearest layout). A reader who
 * left for a funnel landing and pressed Back met a stale render of exactly
 * that — a page assembled for a request that already finished — with nothing
 * to catch it if it threw. Only a manual reload, which asks the server for
 * the page fresh, ever put it right.
 *
 * `pageshow` fires on every load, including a normal one, but only a
 * bfcache restore sets `event.persisted`. Reloading only then is
 * indistinguishable from the fix a reader was already reaching for — it
 * costs one request on the rare path back into the platform from outside it,
 * not on every navigation within it (Next's client router never fires this
 * event for its own transitions).
 */
export function BfcacheRestore() {
  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) window.location.reload();
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  return null;
}
