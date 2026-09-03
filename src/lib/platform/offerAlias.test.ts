import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Course } from "@/lms-core";

/**
 * Every course product is sold under two codes: the platform charges
 * `course:<slug>` from the offer row, and the funnel landing links
 * `?product=<legacy>`, which used to be charged from the constant in
 * `PRODUCTS`. Two numbers for one course.
 *
 * These tests hold the two doors to one price. They were written for
 * `reset-day`, the first product aliased, and the gap they did not cover cost
 * exactly what the file predicted: way21's landing quoted 4100 ₴ in its own CTA
 * and charged 1 ₴, because a QA price had been opened in the constant that the
 * row knew nothing about. So the alias list is now walked whole.
 */

const getLiveCourse = vi.fn();
const readOfferRow = vi.fn();
const readProductOffer = vi.fn();

vi.mock("next/cache", () => ({
  unstable_cache: (fn: () => unknown) => fn,
}));

vi.mock("@/lib/platform/productOffers", () => ({
  loadProductOffer: (code: string) => readProductOffer(code),
  PRODUCT_OFFERS_TAG: "product-offers",
}));

vi.mock("@/lib/lms/liveCatalog", () => ({
  getLiveCourse: (slug: string) => getLiveCourse(slug),
  listLiveCourses: async () => [],
  COURSE_LIST_TAG: "courses",
  courseTag: (slug: string) => `course:${slug}`,
}));

vi.mock("@/lib/supabaseAdmin", () => ({
  supabaseAdmin: () => {
    const chain: Record<string, unknown> = {};
    chain.select = () => chain;
    chain.eq = () => chain;
    chain.limit = async () => readOfferRow();
    return { from: () => chain };
  },
}));

const publishedCourse = {
  id: "c-1",
  slug: "reset-day",
  title: "Розвантажувальний день",
  status: "published",
  visibility: "listed",
  modules: [],
} as unknown as Course;

const offerRow = {
  data: [
    {
      code: "course:reset-day",
      course_id: "c-1",
      amount: 795,
      list_amount: 1200,
      currency: "UAH",
      pixel_content_name: "Reset Day",
      active: true,
    },
  ],
  error: null,
};

beforeEach(() => {
  vi.resetModules();
  getLiveCourse.mockReset();
  readOfferRow.mockReset();
  readProductOffer.mockReset();
  // No row unless a test says otherwise, which is the state of every course
  // product: they are priced in `lms_course_offers`, not here.
  readProductOffer.mockResolvedValue(null);
});

describe("the legacy reset-day code", () => {
  it("is charged the offer row's price, not the constant's", async () => {
    getLiveCourse.mockResolvedValue(publishedCourse);
    readOfferRow.mockReturnValue(offerRow);
    const { loadPayableOffer } = await import("./offers");

    const offer = await loadPayableOffer("reset-day");

    // The figure comes from the row. If this ever reads the constant again, the
    // landing quotes one number and charges another the day they diverge.
    expect(offer?.amount).toBe(795);
    expect(offer?.listAmount).toBe(1200);
    // And the order is filed under the canonical code, so one course is one
    // product in orders, in Meta and in the entitlement.
    expect(offer?.code).toBe("course:reset-day");
  });

  it("keeps the hand-written invoice prose, which the row cannot express", async () => {
    getLiveCourse.mockResolvedValue(publishedCourse);
    readOfferRow.mockReturnValue(offerRow);
    const { loadPayableOffer } = await import("./offers");
    const { PRODUCTS } = await import("@/lib/products");

    const offer = await loadPayableOffer("reset-day");

    // A course row yields one title in one language; the constant has a real
    // sentence in both, and a WayForPay invoice line is read by a person.
    expect(offer?.heading).toEqual(PRODUCTS["reset-day"].heading);
    expect(offer?.description.en).not.toBe(offer?.description.uk);
  });

  it("stops selling when the offer is withdrawn, instead of falling back to the constant", async () => {
    getLiveCourse.mockResolvedValue(publishedCourse);
    readOfferRow.mockReturnValue({ data: [], error: null });
    const { loadPayableOffer } = await import("./offers");

    // Deliberate: one door must not keep selling a course the storefront calls
    // closed.
    expect(await loadPayableOffer("reset-day")).toBeNull();
  });
});

describe("every legacy code that names a course", () => {
  /* The four that resolve to a row, with the slug each one points at. Written
     out rather than imported so that adding a product to COURSE_CODE_ALIASES
     without deciding what it charges fails here. */
  const ALIASED: Array<{ code: string; slug: string; pixel: string }> = [
    { code: "short", slug: "short", pixel: "Short Reboot" },
    { code: "irem", slug: "irem-gymnastics", pixel: "IREM" },
    { code: "way21", slug: "way21", pixel: "Way21 Detox" },
    { code: "reset-day", slug: "reset-day", pixel: "Reset Day" },
  ];

  it.each(ALIASED)("charges $code from the row, never from the constant", async ({ code, slug }) => {
    getLiveCourse.mockResolvedValue({ ...publishedCourse, slug } as unknown as Course);
    readOfferRow.mockReturnValue({
      data: [
        {
          code: `course:${slug}`,
          course_id: "c-1",
          // A figure that appears in no constant, so a pass cannot come from
          // the file this is meant to stop reading.
          amount: 1234,
          list_amount: 5678,
          currency: "UAH",
          pixel_content_name: "row",
          active: true,
        },
      ],
      error: null,
    });
    const { loadPayableOffer } = await import("./offers");

    const offer = await loadPayableOffer(code);

    expect(offer?.amount).toBe(1234);
    expect(offer?.listAmount).toBe(5678);
    // Filed under the canonical code, so one course is one product in orders,
    // in Meta and in the entitlement.
    expect(offer?.code).toBe(`course:${slug}`);
  });

  it.each(ALIASED)("keeps $code's hand-written invoice prose", async ({ code, slug }) => {
    getLiveCourse.mockResolvedValue({ ...publishedCourse, slug } as unknown as Course);
    readOfferRow.mockReturnValue({
      data: [{ code: `course:${slug}`, course_id: "c-1", amount: 100, list_amount: null, currency: "UAH", pixel_content_name: "row", active: true }],
      error: null,
    });
    const { loadPayableOffer } = await import("./offers");
    const { PRODUCTS } = await import("@/lib/products");

    const offer = await loadPayableOffer(code);

    // A WayForPay invoice line is read by a person, and the row yields one
    // title in one language where the constant has a sentence in two.
    expect(offer?.heading).toEqual(PRODUCTS[code as keyof typeof PRODUCTS].heading);
    expect(offer?.description.en).not.toBe(offer?.description.uk);
  });

  it.each(ALIASED)("stops selling $code when its offer is withdrawn", async ({ code, slug }) => {
    getLiveCourse.mockResolvedValue({ ...publishedCourse, slug } as unknown as Course);
    readOfferRow.mockReturnValue({ data: [], error: null });
    const { loadPayableOffer } = await import("./offers");

    expect(await loadPayableOffer(code)).toBeNull();
  });
});

describe("the products that are not a course of their own", () => {
  /* `lms_course_offers` is unique on course_id, so neither of these can have a
     row there: way21-support is a second offer against the way21 course, and
     herbs is not a course at all. Since 2026-09-03 they are priced in
     `product_offers` instead, and none of it goes near the course tables. */

  it("charges herbs from its product_offers row", async () => {
    readProductOffer.mockResolvedValue({
      code: "herbs",
      amount: 640,
      listAmount: null,
      currency: "UAH",
      kind: "checkout",
      pixelContentName: null,
      active: true,
      updatedAt: null,
    });
    const { loadPayableOffer } = await import("./offers");

    const offer = await loadPayableOffer("herbs");

    expect(offer?.amount).toBe(640);
    // Prose stays hand-written: a row has no sentence in two languages, and a
    // WayForPay invoice line is read by a person.
    const { PRODUCTS } = await import("@/lib/products");
    expect(offer?.heading).toEqual(PRODUCTS.herbs.heading);
    expect(getLiveCourse).not.toHaveBeenCalled();
  });

  it("refuses a checkout for a package sold as an enquiry", async () => {
    readProductOffer.mockResolvedValue({
      code: "way21-support",
      amount: 9000,
      listAmount: null,
      currency: "UAH",
      kind: "lead",
      pixelContentName: null,
      active: true,
      updatedAt: null,
    });
    const { loadPayableOffer } = await import("./offers");

    // The way21 landing quotes this figure beside a lead form and has no buy
    // button for it. A price typed into the admin must not become one.
    expect(await loadPayableOffer("way21-support")).toBeNull();
  });

  it("refuses a checkout when the price is «за запитом»", async () => {
    readProductOffer.mockResolvedValue({
      code: "herbs",
      amount: null,
      listAmount: null,
      currency: "UAH",
      kind: "checkout",
      pixelContentName: null,
      active: true,
      updatedAt: null,
    });
    const { loadPayableOffer } = await import("./offers");

    // Null is not zero and not a free sale: it means nobody has agreed a figure.
    expect(await loadPayableOffer("herbs")).toBeNull();
  });

  it("falls back to the constant when no row exists at all", async () => {
    readProductOffer.mockResolvedValue(null);
    const { loadPayableOffer } = await import("./offers");
    const { PRODUCTS } = await import("@/lib/products");

    /* Unlike a course, where an absent offer is the owner declining to sell.
       These products were sold from a hand-written constant for as long as they
       have existed, so an absent row is an absence — and closing a live
       checkout over it would be a decision nobody made. Safe here because both
       doors read this one function, which is what the way21 bug was actually
       about. */
    const offer = await loadPayableOffer("herbs");
    expect(offer?.amount).toBe(PRODUCTS.herbs.amount);
  });
});
