import { describe, expect, it } from "vitest";

import { landingIndex } from "./useRowDrag";

/**
 * The off-by-one, isolated.
 *
 * A drop names a position in the list the author can see, which still holds the
 * row being carried. Every case below is that list of five, `a b c d e`, with
 * one row picked up and put somewhere.
 */
const move = (list: string[], from: number, to: number, edge: "before" | "after") => {
  const next = [...list];
  const [carried] = next.splice(from, 1);
  next.splice(landingIndex(from, to, edge, true), 0, carried);
  return next.join("");
};

const LIST = ["a", "b", "c", "d", "e"];

describe("landingIndex", () => {
  it("carries a row down the list", () => {
    expect(move(LIST, 0, 2, "after")).toBe("bcade");
    expect(move(LIST, 0, 4, "after")).toBe("bcdea");
  });

  it("carries a row up the list", () => {
    expect(move(LIST, 3, 1, "before")).toBe("adbce");
    expect(move(LIST, 4, 0, "before")).toBe("eabcd");
  });

  it("leaves the list alone when the drop names the place the row already is", () => {
    // Dropping on the near side of a neighbour is the position the row holds.
    expect(move(LIST, 1, 2, "before")).toBe("abcde");
    expect(move(LIST, 1, 0, "after")).toBe("abcde");
  });

  it("does not subtract when the row comes from another list", () => {
    // Nothing was removed above the target, so the raw position stands.
    expect(landingIndex(4, 1, "before", false)).toBe(1);
    expect(landingIndex(4, 1, "after", false)).toBe(2);
  });
});
