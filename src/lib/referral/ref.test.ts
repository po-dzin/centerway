import { describe, expect, it } from "vitest";

import { keepRef, normalizeRef, refFromSearch, utmFromSearch } from "./ref";

describe("normalizeRef", () => {
  it("accepts a plain tag, in any case", () => {
    expect(normalizeRef("Olena")).toBe("olena");
    expect(normalizeRef("  taras_k-2 ")).toBe("taras_k-2");
  });

  it("refuses anything that is not a tag", () => {
    for (const bad of ["", "-olena", "олена", "a b", "x".repeat(65), "<script>", "a/b", null, 7]) {
      expect(normalizeRef(bad), String(bad)).toBeNull();
    }
  });
});

describe("refFromSearch", () => {
  it("reads the tag from a full URL, a query string or params", () => {
    expect(refFromSearch("https://www.centerway.net.ua/way21?ref=olena&utm_source=ig")).toBe("olena");
    expect(refFromSearch("?ref=Olena")).toBe("olena");
    expect(refFromSearch(new URLSearchParams("ref=olena"))).toBe("olena");
    expect(refFromSearch("?utm_source=ig")).toBeNull();
  });
});

describe("keepRef", () => {
  it("lets the first touch stand", () => {
    expect(keepRef("olena", "taras")).toBe("olena");
    expect(keepRef(null, "taras")).toBe("taras");
  });

  it("does not let a malformed value evict or become the tag", () => {
    expect(keepRef("olena", "<x>")).toBe("olena");
    expect(keepRef("<x>", "taras")).toBe("taras");
    expect(keepRef(undefined, undefined)).toBeNull();
  });
});

describe("utmFromSearch", () => {
  it("collects the set and bounds each value", () => {
    expect(utmFromSearch("?utm_source=ig&utm_campaign=way21&x=1")).toEqual({ source: "ig", campaign: "way21" });
    expect(utmFromSearch("?utm_source=" + "a".repeat(300))?.source).toHaveLength(120);
    expect(utmFromSearch("?ref=olena")).toBeNull();
  });
});
