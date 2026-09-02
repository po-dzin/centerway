import { describe, expect, it } from "vitest";

import { programs } from "./content";
import { courseOfferCommerce, resolveOfferCommerce } from "./offerCommerce";
import type { CourseOffer } from "./offers";

describe("resolveOfferCommerce", () => {
  it("sells the four offers that have both a checkout and an agreed price", () => {
    for (const slug of ["reboot", "reset-day", "way21", "irem"]) {
      const commerce = resolveOfferCommerce(slug);
      expect(commerce.mode, slug).toBe("checkout");
      if (commerce.mode !== "checkout") return;
      expect(commerce.checkoutHref).toContain("/api/pay/start?product=");
      expect(commerce.price).toMatch(/\d/);
    }
  });

  it("quotes the LIST price, never the charged one", () => {
    // The 1 ₴ QA window is open (CW_TEST_PRICE_1UAH), so these two differ. A
    // page reading PRODUCTS[...].amount would advertise a hryvnia; this is the
    // test that fails if anyone reconnects them.
    const way21 = resolveOfferCommerce("way21");
    expect(way21.mode === "checkout" && way21.price).toContain("4");
    expect(way21.mode === "checkout" && way21.price).not.toBe("1 ₴");
  });

  it("falls back to a form when no price has been agreed", () => {
    // herbs has a WayForPay route but no figure anyone decided to charge.
    expect(resolveOfferCommerce("herbs")).toEqual({ mode: "lead", leadProductCode: "herbs" });
    expect(resolveOfferCommerce("natural-body")).toEqual({ mode: "lead", leadProductCode: "natural-body" });
  });

  it("never leaves a catalogue offer without a way to convert", () => {
    for (const program of programs) {
      const commerce = resolveOfferCommerce(program.slug);
      if (commerce.mode === "lead") expect(commerce.leadProductCode.length).toBeGreaterThan(0);
      else if (commerce.mode === "free") expect(commerce.accessHref.length).toBeGreaterThan(0);
      else expect(commerce.checkoutHref.length).toBeGreaterThan(0);
    }
  });
});

describe("courseOfferCommerce", () => {
  const offer = (over: Partial<CourseOffer> = {}): CourseOffer => ({
    code: "course:reset-day",
    courseId: "course-reset",
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
