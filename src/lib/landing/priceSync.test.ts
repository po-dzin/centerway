import { describe, expect, it } from "vitest";
import { applyCheckoutGate, applyPriceSync, collectCheckoutCodes, collectPriceCodes } from "./priceSync";

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

/* The herbs hero, copied from the page it broke on: an anchor that names the
   enquiry form in its href and is claimed by checkout.js all the same. */
const HERBS_CTA =
  '<a href="#lead" class="btn btn-primary" data-cta-hero data-cw-checkout data-cw-product="herbs" data-cw-offer-id="herbs_single" data-cw-content-name="Herbal Blend">Замовити збір</a>';

describe("collectCheckoutCodes", () => {
  it("finds every product a page offers to charge for", () => {
    expect(collectCheckoutCodes(HERBS_CTA)).toEqual(["herbs"]);
  });

  it("reads the two attributes in either order", () => {
    expect(collectCheckoutCodes('<button data-cw-product="way21" data-cw-checkout>Купити</button>')).toEqual([
      "way21",
    ]);
  });

  it("ignores a product named without a checkout on it", () => {
    // `data-cw-product` alone is a pixel label, not a buy button.
    expect(collectCheckoutCodes('<a data-cw-product="herbs" data-cw-price-value="1">Замовити</a>')).toEqual([]);
  });
});

describe("applyCheckoutGate", () => {
  it("hands the click back to the anchor when there is no price to charge", () => {
    const out = applyCheckoutGate(HERBS_CTA, new Set(["herbs"]));
    expect(out).not.toContain("data-cw-checkout");
    // Everything the pixel reads survives, and so does the destination the
    // markup already named — the button is not made dead, it is made honest.
    expect(out).toContain('href="#lead"');
    expect(out).toContain('data-cw-product="herbs"');
    expect(out).toContain('data-cw-content-name="Herbal Blend"');
    expect(out).toContain("Замовити збір");
  });

  it("leaves a product that may be charged exactly as it was", () => {
    expect(applyCheckoutGate(HERBS_CTA, new Set(["way21"]))).toEqual(HERBS_CTA);
    expect(applyCheckoutGate(HERBS_CTA, new Set())).toEqual(HERBS_CTA);
  });

  it("never opens a checkout the page did not declare", () => {
    const plain = '<a href="#lead">Замовити збір</a>';
    expect(applyCheckoutGate(plain, new Set(["herbs"]))).toEqual(plain);
  });

  it("closes every trigger for the product, not only the first", () => {
    const out = applyCheckoutGate(`${HERBS_CTA}\n<p>текст</p>\n${HERBS_CTA}`, new Set(["herbs"]));
    expect(out).not.toContain("data-cw-checkout");
  });
});
