import { describe, expect, it } from "vitest";

import { FOCUS_STOPS, nextStop } from "./focusRing";

/**
 * The arithmetic of the ring a portalled sheet has to supply for itself. The
 * DOM half is verified in the browser; this is the half that can be reasoned
 * about, and the half where an off-by-one silently strands a reader on the
 * last row.
 */
describe("nextStop", () => {
  it("steps forward and back inside the ring", () => {
    expect(nextStop(5, 0, 1)).toBe(1);
    expect(nextStop(5, 3, 1)).toBe(4);
    expect(nextStop(5, 4, -1)).toBe(3);
    expect(nextStop(5, 1, -1)).toBe(0);
  });

  it("wraps at both ends rather than letting focus escape into the page", () => {
    /* Escaping at the last row is the reported bug again, two rows later: the
       sheet stays open and the reader is back in the document behind it. */
    expect(nextStop(5, 4, 1)).toBe(0);
    expect(nextStop(5, 0, -1)).toBe(4);
  });

  it("enters at the end the key is heading towards when focus is outside", () => {
    /* -1 is what `indexOf` returns for the page's own focus, and for a click
       that landed on the panel's background rather than on a row. */
    expect(nextStop(5, -1, 1)).toBe(0);
    expect(nextStop(5, -1, -1)).toBe(4);
  });

  it("treats an index past the end as outside, not as the end", () => {
    /* The install disclosure removes stops when it collapses, so a remembered
       index can outlive the ring it was measured against. */
    expect(nextStop(3, 7, 1)).toBe(0);
    expect(nextStop(3, 3, -1)).toBe(2);
  });

  it("reports no stop for an empty ring instead of dividing by zero", () => {
    expect(nextStop(0, -1, 1)).toBe(-1);
    expect(nextStop(0, 0, -1)).toBe(-1);
  });

  it("survives a full lap in both directions", () => {
    const count = 4;
    let forward = 0;
    for (let i = 0; i < count; i += 1) forward = nextStop(count, forward, 1);
    expect(forward).toBe(0);
    let back = 0;
    for (let i = 0; i < count; i += 1) back = nextStop(count, back, -1);
    expect(back).toBe(0);
  });
});

describe("FOCUS_STOPS", () => {
  it("counts what these sheets actually hold", () => {
    /* Rows are links and buttons, the install offer is a disclosure, and the
       theme control is three toggles. */
    for (const stop of ["a[href]", "button:not([disabled])", "summary"]) {
      expect(FOCUS_STOPS).toContain(stop);
    }
  });

  it("excludes the shield, which declares itself out of the order", () => {
    /* `ChromeSheetPanel` gives the scrim `tabIndex={-1}`; a shield that could
       be tabbed to would be a stop between the last row and the first. */
    expect(FOCUS_STOPS).toContain('[tabindex]:not([tabindex="-1"])');
    expect(FOCUS_STOPS).not.toMatch(/\[tabindex\](?!:not)/);
  });
});
