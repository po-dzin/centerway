"use client";

/**
 * The half of a route transition that lives on the other side of the trip.
 *
 * Mounted once in the platform layout, above every page, because it has to
 * outlive the navigation it is reporting on: the link that started the movement
 * is usually unmounted by the time the movement can end. All it does is watch
 * the pathname and say «the next route is in the DOM now» — see
 * `routeTransition.ts` for why that sentence is the hard part.
 *
 * A LAYOUT effect, never a passive one. `useEffect` runs after the browser has
 * painted, which means the new route would flash on screen at full opacity
 * before the transition had finished holding the old one — the exact seam the
 * transition exists to remove. `useLayoutEffect` runs after the DOM is updated
 * and before that paint, which is the only frame worth handing back.
 *
 * Renders nothing, and deliberately: it is a listener, not a wrapper. Wrapping
 * the tree would put a component between the layout and every page for the sake
 * of an animation, and anything that re-rendered here would re-render all of
 * them.
 */

import { useLayoutEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

import { settleRouteMotion } from "./routeTransition";

export function RouteMotion() {
  const pathname = usePathname();
  /* The search string counts as a destination too: a draft preview and the
     lesson it previews are one path with two `?preview=` states, and a reader
     moving between them has moved. */
  const search = useSearchParams()?.toString() ?? "";

  useLayoutEffect(() => {
    settleRouteMotion();
  }, [pathname, search]);

  return null;
}
