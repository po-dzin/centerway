"use client";

/**
 * ONE NAVIGATION, DRAWN AS ONE MOVEMENT.
 *
 * `viewTransition.ts` next door does this for changes that are already in hand:
 * call it, the change happens inside it, the next frame is the finished state.
 * A route change is not that shape, and the difference is the whole reason this
 * file exists.
 *
 * WHAT MAKES A ROUTE HARD. `startViewTransition` holds the old frame on screen
 * until the callback it was given settles, then cross-fades to whatever is
 * there. That contract is perfect for a synchronous swap and a trap for a
 * navigation: `router.push()` returns long before the next route has rendered,
 * so resolving on it cross-fades the old screen into the same old screen and
 * the real one appears afterwards, un-transitioned. Resolving too LATE is worse
 * — the page is frozen, and a frozen page does not read as a slow animation, it
 * reads as a hang.
 *
 * SO THE MOVEMENT ENDS WHEN THE NEXT ROUTE HAS ACTUALLY COMMITTED. `RouteMotion`
 * sits in the layout watching the pathname, and calls `settleRouteMotion` from a
 * LAYOUT effect — after React has put the new DOM in place and before the
 * browser has painted it, which is exactly the moment the new frame is worth
 * snapshotting. The resolver lives here, in module scope, because the two halves
 * are on opposite sides of a navigation: the component that starts the movement
 * is usually unmounted by the one that finishes it.
 *
 * AND IT ALWAYS ENDS. A navigation can be cancelled, refused by a guard, or
 * land on the path it was already on, and none of those move the pathname. Every
 * movement therefore carries a deadline: when it passes, the transition settles
 * on whatever is on screen. The failure mode of this file is a missing
 * animation, never a stuck page — which is the only acceptable way for it to be
 * wrong.
 *
 * THE MEMORY IS WHAT MAKES IT WORTH DOING. Before `libraryMemory.ts` the next
 * screen was a loading state for a few hundred milliseconds, so the honest
 * thing to cross-fade into was a spinner. Now a lesson the reader has opened —
 * or the next one, warmed on idle — commits on the first frame, and there is a
 * real destination to move to.
 */

/* Long enough for a route that has to reach the network on a slow connection,
   short enough that a reader never wonders whether the tap registered. Past it,
   the transition finishes against whatever is on screen — usually the next
   route's own loading state, which is a truthful thing to arrive at. */
const DEADLINE_MS = 450;

let settle: (() => void) | null = null;
let deadline: number | null = null;

function finish(): void {
  if (deadline !== null) {
    window.clearTimeout(deadline);
    deadline = null;
  }
  const resolve = settle;
  settle = null;
  resolve?.();
}

type TransitionDocument = Document & {
  startViewTransition?: (callback: () => void | Promise<void>) => { finished: Promise<void> };
};

function movementIsWelcome(): boolean {
  try {
    return !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/**
 * Runs a navigation, drawn as one movement where the browser can draw one.
 *
 * `go` is always called exactly once. Everything else here — the transition, the
 * waiting, the deadline — is decoration around that promise, and a browser that
 * cannot do any of it simply navigates.
 */
export function navigateAsOneMovement(go: () => void): void {
  if (typeof document === "undefined") {
    go();
    return;
  }
  const doc = document as TransitionDocument;

  /* A second tap while one movement is still running: let it navigate plainly
     rather than stacking transitions, which the browser would resolve by
     skipping one of them anyway — and skipping is the ugly outcome. */
  if (typeof doc.startViewTransition !== "function" || !movementIsWelcome() || settle) {
    go();
    return;
  }

  doc.startViewTransition(
    () =>
      new Promise<void>((resolve) => {
        settle = resolve;
        deadline = window.setTimeout(finish, DEADLINE_MS);
        go();
      }),
  );
}

/** Called by `RouteMotion` once the next route is in the DOM. */
export function settleRouteMotion(): void {
  finish();
}
