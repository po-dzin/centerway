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

/* ONE SHEET AT A TIME, HANDED OVER RATHER THAN CLOSED AND REOPENED (2026-09-13).
   The burger and the avatar are separate sheets with separate state, and they
   were exclusive only by accident: the `pointerdown` that reached for the
   second one landed outside the first and closed it, and the second opened on
   the `click` that followed. Between those two events the browser painted
   frames with no sheet at all — the scrim gone, the islands dropped back to
   their row, the bar unlocked — and then the whole thing unfolded again. On
   the admin panel and the storefront's phone chrome that read as the menu
   blinking every time the reader moved from one control to the other.

   So the sheets know about each other. A sheet that opens closes the others in
   the SAME event handler, which React batches into one render — the open state
   is handed over, never dropped. The outside click leaves a sibling's trigger
   alone, because that trigger is about to do the closing itself. */
const openSheets = new Map<symbol, () => void>();

/** Registered by a sheet while it is open, with the way to close it. */
export function registerOpenSheet(id: symbol, close: () => void): () => void {
  openSheets.set(id, close);
  return () => {
    if (openSheets.get(id) === close) openSheets.delete(id);
  };
}

/** Close every open sheet but `id`. Returns whether any was open. */
export function closeOtherSheets(id: symbol): boolean {
  let handed = false;
  for (const [other, close] of openSheets) {
    if (other === id) continue;
    close();
    handed = true;
  }
  return handed;
}

/** The marker a chrome control's trigger carries, so outside-clicks can tell. */
export const CHROME_SHEET_TRIGGER = "data-cw-chrome-trigger";

/** The server renders no sheet, so the bar is never locked there. */
export function chromeSheetClosedOnServer() {
  return false;
}
