import { describe, expect, it } from "vitest";

import {
  EMPTY_CATALOG_QUERY,
  catalogFacets,
  countCatalogNarrowing,
  filterCatalog,
  isCatalogQueryEmpty,
  matchesCatalogQuery,
  readCatalogQuery,
  writeCatalogQuery,
  type CatalogItem,
} from "./catalogQuery";

const course: CatalogItem = {
  title: "Шлях 21",
  description: "Детокс на 21 день",
  keywords: ["Очищення", "Курс"],
  categories: ["cleansing"],
  kind: "course",
  amount: 1795,
};

const freeChecklist: CatalogItem = {
  title: "Ранковий чек-лист",
  keywords: ["Рух", "Чек-лист"],
  categories: ["movement"],
  kind: "checklist",
  amount: 0,
};

const unpriced: CatalogItem = {
  title: "IREM гімнастика",
  categories: ["movement"],
  kind: "mini",
  amount: null,
};

const catalogue = [course, freeChecklist, unpriced];

describe("catalog query contract", () => {
  it("treats an untouched query as no narrowing at all", () => {
    expect(isCatalogQueryEmpty(EMPTY_CATALOG_QUERY)).toBe(true);
    expect(filterCatalog(catalogue, EMPTY_CATALOG_QUERY, (one) => one)).toHaveLength(3);
  });

  it("widens within one axis and narrows across two", () => {
    const kinds = { ...EMPTY_CATALOG_QUERY, kinds: ["course", "checklist"] as const };
    expect(filterCatalog(catalogue, kinds, (one) => one)).toEqual([course, freeChecklist]);

    const both = { ...kinds, categories: ["cleansing"] as const };
    expect(filterCatalog(catalogue, both, (one) => one)).toEqual([course]);
  });

  it("keeps a zero price and a missing price apart", () => {
    const free = { ...EMPTY_CATALOG_QUERY, freeOnly: true };
    expect(matchesCatalogQuery(freeChecklist, free)).toBe(true);
    expect(matchesCatalogQuery(unpriced, free)).toBe(false);
    expect(matchesCatalogQuery(course, free)).toBe(false);
  });

  it("puts an unpriced offer outside every interval, open ends included", () => {
    const anyPrice = { ...EMPTY_CATALOG_QUERY, price: { min: 0, max: null } };
    expect(matchesCatalogQuery(unpriced, anyPrice)).toBe(false);
    expect(matchesCatalogQuery(freeChecklist, anyPrice)).toBe(true);
  });

  it("reads both ends of the interval inclusively", () => {
    const band = { ...EMPTY_CATALOG_QUERY, price: { min: 0, max: 1795 } };
    expect(filterCatalog(catalogue, band, (one) => one)).toEqual([course, freeChecklist]);
    expect(matchesCatalogQuery(course, { ...EMPTY_CATALOG_QUERY, price: { min: null, max: 1794 } })).toBe(false);
  });

  it("searches the words a reader can see on the card, not only the title", () => {
    const byCategoryWord = { ...EMPTY_CATALOG_QUERY, text: "очищення" };
    expect(filterCatalog(catalogue, byCategoryWord, (one) => one)).toEqual([course]);
    expect(matchesCatalogQuery(course, { ...EMPTY_CATALOG_QUERY, text: "детокс" })).toBe(true);
  });

  it("never reorders — a filter answers which, not in what sequence", () => {
    const query = { ...EMPTY_CATALOG_QUERY, categories: ["movement"] as const };
    expect(filterCatalog(catalogue, query, (one) => one)).toEqual([freeChecklist, unpriced]);
  });

  it("counts each narrowing axis once for the control's badge", () => {
    expect(countCatalogNarrowing(EMPTY_CATALOG_QUERY)).toBe(0);
    expect(
      countCatalogNarrowing({
        text: "ignored",
        kinds: ["mini"],
        categories: ["movement", "nutrition"],
        price: { min: 100, max: 900 },
        freeOnly: true,
      }),
    ).toBe(5);
  });

  it("offers only the facets this catalogue actually holds", () => {
    expect(catalogFacets(catalogue)).toEqual({
      kinds: ["course", "mini", "checklist"],
      categories: ["movement", "cleansing"],
      priceFloor: 0,
      priceCeiling: 1795,
      freeCount: 1,
    });
    expect(catalogFacets([unpriced])).toEqual({
      kinds: ["mini"],
      categories: ["movement"],
      priceFloor: null,
      priceCeiling: null,
      freeCount: 0,
    });
  });

  it("round-trips through a shareable address and drops the untouched axes", () => {
    const query = {
      text: " детокс ",
      kinds: ["course"] as const,
      categories: ["cleansing"] as const,
      price: { min: null, max: 2000 },
      freeOnly: false,
    };
    const written = writeCatalogQuery(query);
    expect(written.toString()).toBe("q=%D0%B4%D0%B5%D1%82%D0%BE%D0%BA%D1%81&kind=course&topic=cleansing&max=2000");
    expect(readCatalogQuery(written)).toEqual({ ...query, text: "детокс" });
    expect(writeCatalogQuery(EMPTY_CATALOG_QUERY).toString()).toBe("");
  });

  it("ignores codes and amounts an address cannot mean", () => {
    const params = new URLSearchParams("kind=course,nonsense&topic=&min=-5&max=abc&free=yes");
    expect(readCatalogQuery(params)).toEqual({
      text: "",
      kinds: ["course"],
      categories: [],
      price: { min: null, max: null },
      freeOnly: false,
    });
  });
});
