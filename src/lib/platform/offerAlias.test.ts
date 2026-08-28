import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Course } from "@/lms-core";

/**
 * `reset-day` is the one course sold under two codes: the platform charges
 * `course:reset-day` from the offer row, and the funnel landing still links
 * `?product=reset-day`, which used to be charged from the constant in
 * `PRODUCTS`. Two numbers for one course. These tests hold the two doors to one
 * price.
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

  it("leaves the products that are not courses alone", async () => {
    const { loadPayableOffer } = await import("./offers");

    const short = await loadPayableOffer("short");
    expect(short?.code).toBe("short");
    expect(getLiveCourse).not.toHaveBeenCalled();
  });
});
