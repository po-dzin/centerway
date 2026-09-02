import { describe, expect, it } from "vitest";
import { applyPriceSync, collectPriceCodes } from "./priceSync";

const PRICES = {
  way21: { amount: 4100, listAmount: null },
  "reset-day": { amount: 390, listAmount: 795 },
};

describe("collectPriceCodes", () => {
  it("finds every product the page prints a figure for", () => {
    // A landing quotes more than its own product: way21's page carries the
    // guided package and cross-sells a mini-course.
    const html = `
      <b data-cw-price="way21">4100 грн</b>
      <b data-cw-price="way21-support">9000 грн</b>
      <b data-cw-price="reset-day">795 грн</b>
      <a data-cw-product="way21" data-cw-price-value="4100">Купити</a>`;
    expect(collectPriceCodes(html).sort()).toEqual(["reset-day", "way21", "way21-support"]);
  });

  it("asks for nothing when the page marks nothing", () => {
    expect(collectPriceCodes("<b>4100 грн</b>")).toEqual([]);
  });
});

describe("applyPriceSync", () => {
  it("replaces the number and keeps the landing's own words", () => {
    const out = applyPriceSync('<b data-cw-price="way21">4100 грн</b>', { way21: { amount: 3200, listAmount: null } });
    // «грн» survives: imposing a shared formatter here would restyle five
    // selling pages that each chose their own typography.
    expect(out).toBe('<b data-cw-price="way21">3200 грн</b>');
  });

  it("reads the strike-through figure from the list price, not the charged one", () => {
    const html =
      '<div><s data-cw-price="reset-day" data-cw-price-kind="list">1200 грн</s><b data-cw-price="reset-day">795 грн</b></div>';
    const out = applyPriceSync(html, PRICES);
    expect(out).toContain(">795 грн</s>");
    expect(out).toContain(">390 грн</b>");
  });

  it("leaves the typed figure alone when there is nothing to read", () => {
    // A failed database read must not blank the price on a page that paid
    // traffic lands on.
    expect(applyPriceSync('<b data-cw-price="herbs">795 грн</b>', {})).toBe('<b data-cw-price="herbs">795 грн</b>');
    // And a product with no list price keeps whatever the strike-through said.
    const out = applyPriceSync('<s data-cw-price="way21" data-cw-price-kind="list">9000 грн</s>', PRICES);
    expect(out).toContain("9000 грн");
  });

  it("moves the pixel value to the charged amount, never the list price", () => {
    const out = applyPriceSync(
      '<a data-cw-product="reset-day" data-cw-price-value="795">Купити</a>',
      PRICES
    );
    // Meta optimises spend against this number: told a sale is worth the
    // pre-discount figure, a campaign bids for the wrong thing.
    expect(out).toContain('data-cw-price-value="390"');
  });

  it("handles a figure a designer grouped with spaces", () => {
    const out = applyPriceSync('<b data-cw-price="way21">4 100 грн</b>', { way21: { amount: 990, listAmount: null } });
    expect(out).toBe('<b data-cw-price="way21">990 грн</b>');
  });

  it("touches nothing on a page that marks no prices", () => {
    const html = '<div class="hero-price"><b>4100 грн</b><small>повний доступ</small></div>';
    expect(applyPriceSync(html, PRICES)).toBe(html);
  });
});
