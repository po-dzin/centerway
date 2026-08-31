import { describe, expect, it } from "vitest";

import { getCabinetCopy } from "./copy";
import { EMPTY_SHELF_QUERY, isShelfQueryEmpty, matchesShelfQuery } from "./ShelfFilter";

const copy = getCabinetCopy("uk");
const material = {
  title: "Рух для ранку",
  categories: ["movement", "nutrition"] as const,
};

describe("ShelfFilter query contract", () => {
  it("treats no selected categories as an unfiltered shelf", () => {
    expect(isShelfQueryEmpty(EMPTY_SHELF_QUERY)).toBe(true);
    expect(matchesShelfQuery(material, EMPTY_SHELF_QUERY, copy)).toBe(true);
  });

  it("matches any selected category so multiple subjects remain additive", () => {
    expect(matchesShelfQuery(material, { text: "", categories: ["nutrition", "cleansing"] }, copy)).toBe(true);
    expect(matchesShelfQuery(material, { text: "", categories: ["cleansing"] }, copy)).toBe(false);
  });

  it("keeps text search and selected categories in the same predicate", () => {
    expect(matchesShelfQuery(material, { text: "ранку", categories: ["movement"] }, copy)).toBe(true);
    expect(matchesShelfQuery(material, { text: "ранку", categories: ["cleansing"] }, copy)).toBe(false);
  });
});
