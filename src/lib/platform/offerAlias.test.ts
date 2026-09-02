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

vi.mock("next/cache", () => ({
  unstable_cache: (fn: () => unknown) => fn,
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
     row: way21-support is a second offer against the way21 course, and herbs is
     not a course at all. They are read from the constant on purpose — the test
     exists so that "still on the constant" stays a decision somebody made. */
  it.each(["way21-support", "herbs"])("reads %s from PRODUCTS without touching the database", async (code) => {
    const { loadPayableOffer } = await import("./offers");
    const { PRODUCTS } = await import("@/lib/products");

    const offer = await loadPayableOffer(code);

    expect(offer?.code).toBe(code);
    expect(offer?.amount).toBe(PRODUCTS[code as keyof typeof PRODUCTS].amount);
    expect(getLiveCourse).not.toHaveBeenCalled();
  });
});
