"use client";

import { useEffect, useState, type RefObject } from "react";

/**
 * ONE GESTURE REVEALS THE CHROME.
 *
 * A topbar earns its permanence on a surface where you ACT — the builder keeps
 * save state, undo and the preview button, and a bar that walked off mid-edit
 * would be hiding the controls in use. A reading surface is the opposite: the
 * bar is how you LEAVE, and leaving is the one thing you are not doing while
 * you read. Held sticky it spends every scrolled screen covering 65px of the
 * page for a control nobody reached for.
 *
 * SCROLL DIRECTION, NOT SCROLL DEPTH, and the difference is the whole point. A
 * bar that hides below some depth is gone exactly when it is wanted — you would
 * have to scroll to the top of a long lesson to get out of it. Reading runs
 * downward, so "up" is already the gesture that means «I am done here»: it
 * brings the chrome back where the hand is, in one flick, from anywhere in the
 * document.
 *
 * `deep` rides the same signal on purpose. The way back to the top of a long
 * page is chrome too, and giving it its own trigger would mean two controls
 * appearing on two different rules — a floating button that sits there through
 * the whole read is the noise this pattern exists to remove. One gesture, one
 * answer: scroll up and everything you might want is there.
 *
 * WHAT IT WILL NOT DO, each for a reason:
 *
 * - Hide near the top. The first screen has no reading behind it yet, and a bar
 *   that vanishes on the opening scroll reads as a glitch.
 * - Hide while its own menu is open — the burger sheet IS the header, so hiding
 *   it would take the open dialog with it.
 * - Hide while focus is inside it. Tabbing into an invisible control is the
 *   classic keyboard failure of this pattern.
 * - React to a jitter. A trackpad and a thumb both emit tiny opposite-signed
 *   deltas mid-gesture; without a threshold the bar flickers down the page.
 */

/** Below this the chrome is always shown: the opening screen is not "scrolled". */
const TOP_ZONE = 96;
/** Ignore anything smaller — trackpad and touch both emit sub-pixel reversals. */
const JITTER = 6;
/**
 * "Far enough that getting back is a chore" — one whole screen past the top.
 *
 * Measured in viewports rather than pixels because that is what the gesture
 * costs: a flick moves roughly a screen, so beyond one screen the way back is
 * more than one flick, and below it the control would be offering to save a
 * reader a movement they have already half made.
 */
const DEEP_SCREENS = 1;

export type ChromeReveal = {
  /** The bar has stepped aside. */
  hidden: boolean;
  /** Deep enough in the page that the way back to the top is worth offering. */
  deep: boolean;
};

export function useChromeReveal(
  enabled: boolean,
  ref?: RefObject<HTMLElement | null>,
  { locked = false }: { locked?: boolean } = {},
): ChromeReveal {
  const [state, setState] = useState<ChromeReveal>({ hidden: false, deep: false });

  useEffect(() => {
    /* No reset on the way out, and none is needed: the return below DERIVES the
       revealed state while this is off or locked, rather than writing it. The
       write was also the one thing in here React's lint is right to refuse — a
       setState in an effect body is a cascading render, and this one bought
       nothing the derivation was not already doing. */
    if (!enabled || locked) return;

    let last = window.scrollY;
    /* Focus is tracked rather than queried per frame: `:focus-within` cannot
       drive state the scroll handler owns, and reading `document.activeElement`
       on every scroll event is a layout read on every frame. */
    let focusInside = false;

    const update = () => {
      const y = window.scrollY;
      const delta = y - last;
      const deep = y > window.innerHeight * DEEP_SCREENS;
      if (Math.abs(delta) < JITTER) {
        setState((current) => (current.deep === deep ? current : { ...current, deep }));
        return;
      }
      last = y;
      const hidden = !focusInside && y > TOP_ZONE && delta > 0;
      setState((current) =>
        current.hidden === hidden && current.deep === deep ? current : { hidden, deep },
      );
    };

    const onFocusIn = () => {
      focusInside = true;
      setState((current) => (current.hidden ? { ...current, hidden: false } : current));
    };
    const onFocusOut = (event: FocusEvent) => {
      const node = ref?.current;
      const next = event.relatedTarget;
      if (node && next instanceof Node && node.contains(next)) return;
      focusInside = false;
    };

    const node = ref?.current;
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    node?.addEventListener("focusin", onFocusIn);
    node?.addEventListener("focusout", onFocusOut);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      node?.removeEventListener("focusin", onFocusIn);
      node?.removeEventListener("focusout", onFocusOut);
    };
  }, [enabled, locked, ref]);

  if (!enabled || locked) return { hidden: false, deep: state.deep };
  return state;
}
