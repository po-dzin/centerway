import { describe, expect, it } from "vitest";

import { buildReturnDestination } from "@/lib/payReturn";
import {
  PLATFORM_FAILED_URL,
  PLATFORM_THANKS_URL,
  catalogOffer,
  isCatalogProduct,
  isPayableProduct,
  normalizePayableProduct,
  normalizeProduct,
  productReturnUrls,
} from "@/lib/products";
import { courseOfferCommerce } from "@/lib/platform/offerCommerce";

/**
 * The purchase chain for a course that came out of the BUILDER.
 *
 * Everything here guards one of the two failures the storefront pass named and
 * deliberately left standing:
 *
 *   1. an unknown code used to resolve to "short" — so a course button would
 *      have charged the buyer for Short Reboot;
 *   2. a code the entitlement does not accept means a buyer pays and gets
 *      nothing (guarded in lms-core, beside `resolveEntitlement`).
 */
describe("course product codes in the payment path", () => {
  it("keeps a course code intact through normalization", () => {
    expect(normalizeProduct("course:my-course")).toBe("course:my-course");
    expect(normalizeProduct("  COURSE:MY-COURSE ")).toBe("course:my-course");
    expect(normalizePayableProduct("course:my-course")).toBe("course:my-course");
    expect(isPayableProduct("course:my-course")).toBe(true);
  });

  it("refuses a code that is not shaped like one, rather than falling back", () => {
    // The old `resolvePayableProduct` answered every one of these with "short".
    for (const junk of ["course:", "course:../secret", "course:a b", "nonsense", "", null]) {
      expect(normalizePayableProduct(junk), String(junk)).toBeNull();
    }

    // Case is the one thing normalization is allowed to fix — it lowercases
    // every code, the way it already did for "REBOOT". The strict parser used
    // for lookups still refuses an uppercase slug.
    expect(normalizePayableProduct("Course:My-Course")).toBe("course:my-course");
  });

  it("keeps the two namespaces apart", () => {
    expect(isCatalogProduct("course:my-course")).toBe(false);
    expect(isCatalogProduct("short")).toBe(true);
    // PRODUCTS may only ever be indexed by the six, and no key of it can carry
    // a colon — so a database code can never shadow a hand-written one.
    expect(catalogOffer("short").code).toBe("short");
  });

  it("returns a course purchase to the platform confirmation", () => {
    expect(productReturnUrls("course:my-course")).toEqual({
      approvedUrl: PLATFORM_THANKS_URL,
      declinedUrl: PLATFORM_FAILED_URL,
    });

    const paid = new URL(
      buildReturnDestination("paid", "course:my-course", "course-my-course_20260822_ab12", {}, 0)
    );
    expect(paid.pathname).toBe("/pay/thanks");
    expect(paid.searchParams.get("product")).toBe("course:my-course");
    expect(paid.searchParams.get("order_ref")).toBe("course-my-course_20260822_ab12");
  });
});

describe("courseOfferCommerce", () => {
  const offer = {
    code: "course:my-course",
    courseId: "c1",
    courseSlug: "my-course",
    amount: 790,
    listAmount: null,
    currency: "UAH",
    pixelContentName: "My course",
  };

  it("sells a course that has an active offer", () => {
    const commerce = courseOfferCommerce("my-course", offer);
    expect(commerce.mode).toBe("checkout");
    if (commerce.mode !== "checkout") return;
    expect(commerce.checkoutHref).toContain("product=course%3Amy-course");
    // No list price on a database offer means "quote what is charged" — unlike
    // PRODUCTS, there is no test-price split here to hide behind.
    expect(commerce.price).toContain("790");
  });

  it("quotes the struck-through figure when there is one", () => {
    const commerce = courseOfferCommerce("my-course", { ...offer, listAmount: 1200 });
    expect(commerce.mode === "checkout" && commerce.price).toContain("1");
    expect(commerce.mode === "checkout" && commerce.price).toContain("200");
  });

  it("falls back to the form when nobody has priced it", () => {
    expect(courseOfferCommerce("my-course", null)).toEqual({ mode: "lead", leadProductCode: "platform" });
  });
});
