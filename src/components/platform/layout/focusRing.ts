/**
 * THE ORDER A PORTALLED PANEL HAS TO SUPPLY ITSELF.
 *
 * Sequential focus follows DOM order, and a sheet portalled to `document.body`
 * sits at the end of it — so Tab from the trigger in the bar walked into the
 * PAGE rather than into the panel that had just opened over it. A keyboard
 * reader could open the account menu and not reach a single row of it without
 * tabbing through the whole document first.
 *
 * The panel therefore carries its own ring: this module is the arithmetic of
 * that ring, kept apart from the DOM so it can be reasoned about and tested on
 * its own. `ChromeSheet` supplies the elements; these functions decide where
 * the next stop is.
 */

/**
 * What counts as a stop. Deliberately the plain list — the sheets hold links,
 * buttons, a disclosure summary and the theme control's three toggles, and
 * nothing that manages its own roving index. `[tabindex="-1"]` is excluded
 * because that is exactly how the scrim declares it is not a stop.
 */
export const FOCUS_STOPS = [
  "a[href]",
  "button:not([disabled])",
  "summary",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

/**
 * Where Tab goes next inside a closed ring.
 *
 * WRAPPING IS THE POINT, not a nicety. The alternative — letting focus escape
 * at the last row — puts the reader back in the page with the sheet still open
 * over it, which is the bug this exists to fix, only two rows later. Escape and
 * the outside click are how the sheet is left; Tab is how it is read.
 */
export function nextStop(count: number, current: number, step: 1 | -1): number {
  if (count <= 0) return -1;
  /* Focus is somewhere outside the ring — the page still has it, or a click
     landed on the panel's own background. Enter at the end Tab is heading
     towards, so the first Tab reads the first row and Shift+Tab the last. */
  if (current < 0 || current >= count) return step === 1 ? 0 : count - 1;
  return (current + step + count) % count;
}

/** The stops of one panel, in DOM order, skipping anything not rendered. */
export function focusStopsIn(root: HTMLElement | null): HTMLElement[] {
  if (!root) return [];
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUS_STOPS)).filter(
    /* `offsetParent` is not usable here: the panel is `position: fixed`, which
       makes it the offset parent of its own children and would report a
       collapsed row as visible. A box with no client rects has no place a
       cursor could be put. */
    (element) => element.getClientRects().length > 0,
  );
}
