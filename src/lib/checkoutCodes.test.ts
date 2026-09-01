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

  it("returns a paid builder course to its own offer page", () => {
    // The pair the invoice is issued against is unchanged — only where a
    // SUCCESSFUL return is pointed moved, and it is built on this origin.
    expect(productReturnUrls("course:my-course")).toEqual({
      approvedUrl: PLATFORM_THANKS_URL,
      declinedUrl: PLATFORM_FAILED_URL,
    });

    const paid = new URL(
      buildReturnDestination("paid", "course:my-course", "course-my-course_20260822_ab12", {}, 0)
    );
    // The slug is recovered from the CODE, never from the order reference: the
    // colon cannot survive a provider URL, so the reference carries
    // `course-my-course` and a slug of its own may contain dashes. Splitting
    // that back apart is ambiguous by construction; the code is not.
    expect(paid.pathname).toBe("/programs/my-course");
    expect(paid.origin).toBe(new URL(PLATFORM_THANKS_URL).origin);
    expect(paid.searchParams.get("product")).toBe("course:my-course");
    expect(paid.searchParams.get("order_ref")).toBe("course-my-course_20260822_ab12");

    const failed = new URL(
      buildReturnDestination("failed", "course:my-course", "course-my-course_20260822_ab12", {}, 0)
    );
    expect(failed.pathname).toBe("/pay/failed");
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
    expect(commerce.price).toContain("790");
    expect(commerce.compareAtPrice).toBeNull();
  });

  it("keeps the current figure primary and exposes the former one separately", () => {
    const commerce = courseOfferCommerce("my-course", { ...offer, listAmount: 1200 });
    expect(commerce.mode === "checkout" && commerce.price).toContain("790");
    expect(commerce.mode === "checkout" && commerce.compareAtPrice).toContain("1");
    expect(commerce.mode === "checkout" && commerce.compareAtPrice).toContain("200");
  });

  it("turns a zero-priced course into a direct access action, never checkout", () => {
    const commerce = courseOfferCommerce("my-course", { ...offer, amount: 0 });
    expect(commerce).toEqual({
      mode: "free",
      accessHref: "/learn/my-course",
      price: "Безкоштовно",
      compareAtPrice: null,
      amount: 0,
      currency: "UAH",
    });
  });

  it("falls back to the form when nobody has priced it", () => {
    expect(courseOfferCommerce("my-course", null)).toEqual({ mode: "lead", leadProductCode: "platform" });
  });
});
