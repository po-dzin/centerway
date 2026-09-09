"use client";

/**
 * WHETHER A SHEET OPENED FROM THE CHROME IS ON SCREEN.
 *
 * WHY A STORE AND NOT A PROP. `useChromeReveal` already refuses to hide the
 * bar while its own menu is open, and the reason it gives is general: "the
 * burger sheet IS the header, so hiding it would take the open dialog with
 * it." The account popover is the same claim and never reached that rule —
 * `locked` was wired to the burger's state alone, because the burger's state
 * happens to live in `PlatformHeader` while the account sheet's lives two
 * components down, inside `useChromeSheet`.
 *
 * WHAT THE READER SAW (2026-09-10). The popover is portalled to `document.body`
 * and positioned by a measured `top`, so it is not carried by the header's
 * transform. Scrolling down slid the bar away and left the panel behind:
 * either frozen at the pixel it was opened at, or — once the re-measure on
 * scroll landed — tracking the bar off the top of the viewport and hanging
 * there half-clipped, still open, still taking clicks. Both readings are the
 * same missing rule. The bar cannot leave while something it opened is still
 * on screen.
 *
 * NOT A CLOSE-ON-SCROLL. Dismissing the sheet would also clear the screen, and
 * it is the wrong verb: a reader who scrolls one notch with a menu open has
 * not asked to close it, and on a trackpad they may not have meant to scroll
 * at all. Holding the bar keeps the menu attached to the control that owns it
 * and leaves the closing to the outside-click and Escape that already exist.
 *
 * REF-COUNTED, like `installStore`: two sheets can overlap for a frame during
 * a navigation, and the first one to close must not clear a mark the second
 * still needs.
 */

type Listener = () => void;

let openCount = 0;
const listeners = new Set<Listener>();

function emit() {
  for (const listener of listeners) listener();
}

/** Declared by a chrome sheet for as long as it is open. */
export function markChromeSheetOpen(): () => void {
  openCount += 1;
  emit();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    openCount = Math.max(0, openCount - 1);
    emit();
  };
}

export function subscribeChromeSheet(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function isChromeSheetOpen() {
  return openCount > 0;
}

/** The server renders no sheet, so the bar is never locked there. */
export function chromeSheetClosedOnServer() {
  return false;
}
