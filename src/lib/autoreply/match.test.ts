import { describe, expect, it } from "vitest";

import { cleanVariants, matchesKeyword, normalizeKeywords, normalizeText, pickVariant } from "./match";

describe("matchesKeyword", () => {
  const words = ["доша", "dosha"];

  it("matches the word however it is capitalised or punctuated", () => {
    expect(matchesKeyword("ДОША", words)).toBe(true);
    expect(matchesKeyword("Доша!!!", words)).toBe(true);
    expect(matchesKeyword("хочу тест, dosha 🙏", words)).toBe(true);
  });

  it("matches whole words only", () => {
    expect(matchesKeyword("подошла", words)).toBe(false);
    expect(matchesKeyword("дошаа", words)).toBe(false);
  });

  it("matches a keyword made of several words as a run", () => {
    expect(matchesKeyword("Хочу мій тип доші!", ["мій тип"])).toBe(true);
    expect(matchesKeyword("тип мій", ["мій тип"])).toBe(false);
  });

  it("never matches an empty comment or an empty keyword", () => {
    expect(matchesKeyword("", words)).toBe(false);
    expect(matchesKeyword("🙏🙏", words)).toBe(false);
    expect(matchesKeyword("доша", ["", "  "])).toBe(false);
  });
});

describe("normalizeText / normalizeKeywords", () => {
  it("treats ё as е and drops punctuation", () => {
    expect(normalizeText("  Ёлка-Палка! ")).toBe("елка палка");
  });

  it("keeps each word once and ignores non-strings", () => {
    expect(normalizeKeywords(["Доша", "доша!", 5, "", "dosha"])).toEqual(["доша", "dosha"]);
    expect(normalizeKeywords("доша")).toEqual([]);
  });
});

describe("pickVariant", () => {
  it("returns null for no variants and stays inside the list for r close to 1", () => {
    expect(pickVariant([])).toBeNull();
    expect(pickVariant(["a", "b", "c"], () => 0.999999)).toBe("c");
    expect(pickVariant(["a", "b", "c"], () => 0)).toBe("a");
  });
});

describe("cleanVariants", () => {
  it("trims, drops blanks, cuts at five and at the length limit", () => {
    expect(cleanVariants([" a ", "", "  ", "b", "c", "d", "e", "f"], 10)).toEqual(["a", "b", "c", "d", "e"]);
    expect(cleanVariants(["abcdefghij"], 4)).toEqual(["abcd"]);
    expect(cleanVariants(null, 10)).toEqual([]);
  });
});
