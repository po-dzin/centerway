import { describe, expect, it } from "vitest";

import { programs } from "./content";
import { resolveOfferCommerce } from "./offerCommerce";

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
      else expect(commerce.checkoutHref.length).toBeGreaterThan(0);
    }
  });
});
