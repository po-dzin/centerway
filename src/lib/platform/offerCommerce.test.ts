import { describe, expect, it } from "vitest";

import { programs } from "./content";
import { courseOfferCommerce, productOfferCommerce } from "./offerCommerce";
import type { PayableOffer } from "@/lib/products";
import type { CourseOffer } from "./offers";

describe("an offer with no price row", () => {
  it("asks, and files the question under the page's own slug", () => {
    // The lead route resolves the slug through `offer_aliases`, so the page
    // keeps no table of its own: `natural-body` reaches its course's offer.
    expect(courseOfferCommerce("natural-body", null)).toEqual({ mode: "lead", leadProductCode: "natural-body" });
    expect(productOfferCommerce("herbs", null)).toEqual({ mode: "lead", leadProductCode: "herbs" });
  });

  it("never leaves a catalogue page without a way to convert", () => {
    for (const program of programs) {
      const commerce = productOfferCommerce(program.slug, null);
      expect(commerce.mode === "lead" && commerce.leadProductCode.length).toBeGreaterThan(0);
    }
  });
});

describe("courseOfferCommerce", () => {
  const offer = (over: Partial<CourseOffer> = {}): CourseOffer => ({
    code: "course:reset-day",
    courseSlug: "reset-day",
    amount: 0,
    listAmount: null,
    currency: "UAH",
    pixelContentName: "Reset Day",
    ...over,
  });

  it("gives a free course a way in, and no checkout", () => {
    const commerce = courseOfferCommerce("reset-day", offer());
    expect(commerce.mode).toBe("free");
    expect(commerce.mode === "free" && commerce.accessHref).toBe("/learn/reset-day");
    expect(commerce.mode === "free" && commerce.compareAtPrice).toBeNull();
  });

  it("lets a free course say what it used to cost", () => {
    // Free is a price, not the absence of one: «було 795 ₴» is why the hour it
    // asks for is worth giving it.
    const commerce = courseOfferCommerce("reset-day", offer({ listAmount: 795 }));
    expect(commerce.mode === "free" && commerce.compareAtPrice).toMatch(/795/);
  });

  it("never quotes a figure at or below the charged one", () => {
    const paid = courseOfferCommerce("reset-day", offer({ amount: 990, listAmount: 990 }));
    expect(paid.mode === "checkout" && paid.compareAtPrice).toBeNull();
  });
});

describe("productOfferCommerce", () => {
  const priced = (amount: number, listAmount: number | null = null): PayableOffer =>
    ({
      code: "herbs",
      heading: { uk: "Фітозбір", en: "Herbal blend" },
      description: { uk: "Фітозбір", en: "Herbal blend" },
      amount,
      listAmount,
      currency: "UAH",
      pixelContentName: "Herbal Blend",
      fulfilment: { kind: "cabinet" },
      approvedUrl: "https://example.test/thanks",
      declinedUrl: "https://example.test/failed",
    }) as unknown as PayableOffer;

  it("asks when the owner has agreed no price", () => {
    // The whole rule, in one line: no price, the form. Withdrawn, «за запитом»
    // and never-priced all arrive here as the same null.
    expect(productOfferCommerce("herbs", null)).toEqual({ mode: "lead", leadProductCode: "herbs" });
  });

  it("sells at the figure in the row, with no edit to this file", () => {
    const commerce = productOfferCommerce("herbs", priced(640));
    expect(commerce.mode).toBe("checkout");
    if (commerce.mode !== "checkout") return;
    expect(commerce.amount).toBe(640);
    expect(commerce.price).toContain("640");
    expect(commerce.checkoutHref).toContain("product=herbs");
  });

  it("strikes through a former price only when it is higher", () => {
    expect(productOfferCommerce("herbs", priced(640, 800))).toMatchObject({ compareAtPrice: expect.any(String) });
    expect(productOfferCommerce("herbs", priced(640, 640))).toMatchObject({ compareAtPrice: null });
  });
});
