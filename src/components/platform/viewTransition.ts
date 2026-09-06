"use client";

/**
 * ONE CHANGE, DRAWN AS ONE MOVEMENT.
 *
 * The platform swaps whole regions of a screen — the shelf turning from cards
 * into rows into the room — by replacing the markup outright, which the browser
 * paints as a cut. A cut is what a document does. Moving between two states of
 * the same thing is what an application does, and the browser has offered to do
 * it since View Transitions shipped: hand it the change, and it holds the old
 * frame, applies the change, and cross-fades the difference.
 *
 * WHY THIS IS A HELPER AND NOT A ROUTER WRAPPER. The obvious next use is route
 * navigation — shelf → course → lesson — and it is deliberately NOT here. A
 * transition freezes the page until its callback settles, so wrapping a
 * navigation means holding the reader on the old frame until the next route has
 * both loaded and painted. Getting that wrong does not look like a missing
 * animation, it looks like the product hung. This helper is for changes that
 * are SYNCHRONOUS and already in hand: call it, the change happens inside it,
 * and the frame after it is the finished state.
 *
 * REDUCED MOTION IS A REFUSAL, NOT A SHORTER ANIMATION. A reader who has asked
 * their system for less movement is asking for none of this, so the change is
 * made plainly and the browser is never involved.
 */

type TransitionDocument = Document & {
  startViewTransition?: (callback: () => void) => { finished: Promise<void> };
};

function movementIsWelcome(): boolean {
  try {
    return !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    /* No `matchMedia` worth trusting — treat it as "do not animate". The
       quieter answer is the safe one to be wrong about. */
    return false;
  }
}

/**
 * Applies `change`, as one movement where the browser can draw one.
 *
 * Always applies the change exactly once, whatever the browser supports: the
 * caller is handing over a state update, not requesting an effect, and an
 * update that silently did not happen on an older browser would be a bug that
 * only some people could see.
 */
export function asOneMovement(change: () => void): void {
  if (typeof document === "undefined") {
    change();
    return;
  }
  const doc = document as TransitionDocument;
  if (typeof doc.startViewTransition !== "function" || !movementIsWelcome()) {
    change();
    return;
  }
  doc.startViewTransition(change);
}
