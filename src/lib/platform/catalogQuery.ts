/**
 * NARROWING A CATALOGUE — one predicate, one place, for every axis a shelf is
 * filtered by.
 *
 * WHY IT IS ITS OWN MODULE. The learner's shelf already had a narrowing control
 * (`ShelfFilter`), and it answers two axes: a typed word and a set of subjects.
 * The public catalogue needs those two and three more — what KIND of material
 * this is, what it COSTS, and whether it costs nothing at all — and the moment
 * a second surface starts answering "does this course match" on its own, the
 * two surfaces disagree about what «безкоштовно» means. So the question lives
 * here as data and a pure function, and every surface that narrows a list reads
 * it: the programs catalogue, the products rail, and whatever asks next.
 *
 * THE THREE COMMERCIAL STATES ARE THREE, NOT TWO. `amount` is a number or it is
 * null, and null is «ціна за запитом» — an offer nobody has priced. It is NOT
 * zero. A price band therefore excludes it (a course with no figure cannot be
 * inside «до 500 ₴»), and so does the free switch. This is the catalogue
 * contract's own rule: "Нулевая цена является отдельным бесплатным состоянием и
 * не равна отсутствующей цене."
 *
 * EXTENDING IT. A new axis is a field on `CatalogItem`, a field on
 * `CatalogQuery`, one clause in `matchesCatalogQuery`, one facet in
 * `catalogFacets` and one pair of keys in the URL codec below. Nothing outside
 * this file has to learn the new word except the control that offers it.
 */

import { COURSE_CATEGORIES, COURSE_KINDS, type CourseCategory, type CourseKind } from "@/lms-core";

/**
 * What the engine reads off one entry. Deliberately NOT the card: a card is a
 * rendering, and a rendering that also carried the filter's vocabulary would
 * make every new axis a change to a component's props.
 */
export type CatalogItem = {
  title: string;
  description?: string;
  /**
   * Everything else a reader can SEE on the card and might type: the category
   * words, the kind badge, the author's own two lines. A reader who types
   * «харчування» is pointing at the word under the title as much as at the
   * title — the shelf's filter learnt this first, and the rule is the same here.
   */
  keywords?: readonly string[];
  categories?: readonly CourseCategory[];
  kind?: CourseKind;
  /** The price in the offer's own currency, or null for «ціна за запитом». */
  amount: number | null;
};

/**
 * The interval, both ends optional and both INCLUSIVE.
 *
 * Open on either side on purpose: «від 500» and «до 500» are the two halves a
 * reader actually types, and forcing both would make the control refuse the
 * question it is most often asked.
 */
export type CatalogPriceBand = { min: number | null; max: number | null };

export type CatalogQuery = {
  text: string;
  /** Empty means "no narrowing by subject", never "no subject". */
  categories: readonly CourseCategory[];
  kinds: readonly CourseKind[];
  price: CatalogPriceBand;
  /**
   * Free ONLY, which is a stronger statement than `price.max === 0`: it also
   * excludes the unpriced. Kept as its own axis because «покажи безкоштовне» is
   * a question a reader asks in one gesture, not by typing two zeroes.
   */
  freeOnly: boolean;
};

export const EMPTY_CATALOG_QUERY: CatalogQuery = {
  text: "",
  categories: [],
  kinds: [],
  price: { min: null, max: null },
  freeOnly: false,
};

export function isCatalogQueryEmpty(query: CatalogQuery): boolean {
  return (
    query.text.trim() === "" &&
    query.categories.length === 0 &&
    query.kinds.length === 0 &&
    query.price.min === null &&
    query.price.max === null &&
    !query.freeOnly
  );
}

/** How many axes are narrowing right now — the number in the filter's counter. */
export function countCatalogNarrowing(query: CatalogQuery): number {
  return (
    query.categories.length +
    query.kinds.length +
    (query.freeOnly ? 1 : 0) +
    (query.price.min !== null || query.price.max !== null ? 1 : 0)
  );
}

/**
 * Does this entry answer the query?
 *
 * Every axis is AND with every other, and every axis is OR within itself: a
 * reader who ticks «Курс» and «Чек-лист» is widening, and one who ticks «Курс»
 * and «Рух» is narrowing. That is the only reading of a multi-select that does
 * not surprise, and it is what the shelf's filter already does with subjects.
 */
export function matchesCatalogQuery(item: CatalogItem, query: CatalogQuery): boolean {
  if (query.kinds.length > 0 && (item.kind === undefined || !query.kinds.includes(item.kind))) {
    return false;
  }

  if (
    query.categories.length > 0 &&
    !query.categories.some((category) => item.categories?.includes(category))
  ) {
    return false;
  }

  if (query.freeOnly && item.amount !== 0) return false;

  if (query.price.min !== null || query.price.max !== null) {
    // An unpriced offer is outside every interval. It is not cheap and it is
    // not expensive; there is no figure to compare.
    if (item.amount === null) return false;
    if (query.price.min !== null && item.amount < query.price.min) return false;
    if (query.price.max !== null && item.amount > query.price.max) return false;
  }

  const text = query.text.trim().toLowerCase();
  if (!text) return true;

  return [item.title, item.description ?? "", ...(item.keywords ?? [])]
    .join(" ")
    .toLowerCase()
    .includes(text);
}

/**
 * The list, narrowed. Order is never touched — the author's `sortOrder` is the
 * shelf's order, and a filter answers "which of these", not "in what sequence".
 */
export function filterCatalog<T>(
  entries: readonly T[],
  query: CatalogQuery,
  read: (entry: T) => CatalogItem,
): T[] {
  if (isCatalogQueryEmpty(query)) return [...entries];
  return entries.filter((entry) => matchesCatalogQuery(read(entry), query));
}

/**
 * What this particular catalogue can actually be narrowed by.
 *
 * The control is built from this rather than from the closed lists, for the
 * reason the shelf's filter states: a chip that can only ever empty the list is
 * a control with nothing behind it. A catalogue with no priced offer shows no
 * price interval; one with a single kind shows no kind group.
 */
export type CatalogFacets = {
  kinds: CourseKind[];
  categories: CourseCategory[];
  /** The cheapest and dearest PRICED offer, or null when nothing is priced. */
  priceFloor: number | null;
  priceCeiling: number | null;
  /** How many cost exactly nothing — the free switch has nothing to offer at 0. */
  freeCount: number;
};

export function catalogFacets(items: readonly CatalogItem[]): CatalogFacets {
  const kinds = new Set<CourseKind>();
  const categories = new Set<CourseCategory>();
  let priceFloor: number | null = null;
  let priceCeiling: number | null = null;
  let freeCount = 0;

  for (const item of items) {
    if (item.kind) kinds.add(item.kind);
    for (const category of item.categories ?? []) categories.add(category);
    if (item.amount === null) continue;
    if (item.amount === 0) freeCount += 1;
    priceFloor = priceFloor === null ? item.amount : Math.min(priceFloor, item.amount);
    priceCeiling = priceCeiling === null ? item.amount : Math.max(priceCeiling, item.amount);
  }

  return {
    // Ordered by the model's own list rather than by encounter, so the control
    // does not reshuffle itself when an author changes a course's sort order.
    kinds: COURSE_KINDS.filter((kind) => kinds.has(kind)),
    categories: COURSE_CATEGORIES.filter((category) => categories.has(category)),
    priceFloor,
    priceCeiling,
    freeCount,
  };
}

/*
 * THE QUERY AS AN ADDRESS.
 *
 * A narrowed catalogue is something a reader sends to someone else, so the
 * state belongs in the URL and not only in a component. The codec is here
 * rather than in the control because it is part of the same vocabulary: adding
 * an axis without its key would produce a link that silently drops it.
 */

const KEY = {
  text: "q",
  kinds: "kind",
  categories: "topic",
  min: "min",
  max: "max",
  free: "free",
} as const;

function readAmount(raw: string | null): number | null {
  if (raw === null || raw.trim() === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

export function readCatalogQuery(params: URLSearchParams): CatalogQuery {
  const kinds = (params.get(KEY.kinds) ?? "")
    .split(",")
    .filter((one): one is CourseKind => (COURSE_KINDS as readonly string[]).includes(one));
  const categories = (params.get(KEY.categories) ?? "")
    .split(",")
    .filter((one): one is CourseCategory => (COURSE_CATEGORIES as readonly string[]).includes(one));

  return {
    text: params.get(KEY.text) ?? "",
    kinds,
    categories,
    price: { min: readAmount(params.get(KEY.min)), max: readAmount(params.get(KEY.max)) },
    freeOnly: params.get(KEY.free) === "1",
  };
}

/** Only the narrowed axes are written; an empty query is an empty query string. */
export function writeCatalogQuery(query: CatalogQuery): URLSearchParams {
  const params = new URLSearchParams();
  const text = query.text.trim();
  if (text) params.set(KEY.text, text);
  if (query.kinds.length > 0) params.set(KEY.kinds, query.kinds.join(","));
  if (query.categories.length > 0) params.set(KEY.categories, query.categories.join(","));
  if (query.price.min !== null) params.set(KEY.min, String(query.price.min));
  if (query.price.max !== null) params.set(KEY.max, String(query.price.max));
  if (query.freeOnly) params.set(KEY.free, "1");
  return params;
}
