import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Course } from "@/lms-core";

import { FakeSupabase, type Row } from "@/lib/admin/fakeSupabase";

/**
 * ONE CHANNEL FROM A CODE TO A PRICE (2026-09-25).
 *
 * Every course product used to be sold under two codes that read two numbers:
 * the storefront charged `course:<slug>` from the offer row, the landing linked
 * `?product=<legacy>` and was charged from the constant in `PRODUCTS`. The bill
 * arrived on 2026-09-02 — way21's landing quoted 4100 ₴ and charged 1 ₴.
 *
 * Now there is one table of prices and one table of old spellings, and
 * `loadPayableOffer` reads nothing else. These tests walk the spellings
 * production has actually filed orders under and hold them to the row.
 */

const getLiveCourse = vi.fn();
const db = new FakeSupabase();

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
  supabaseAdmin: () => db,
}));

const { loadPayableOffer } = await import("./offers");

const course = (slug: string, overrides: Partial<Course> = {}): Course =>
  ({
    id: `c-${slug}`,
    slug,
    title: `Title of ${slug}`,
    summary: null,
    status: "published",
    visibility: "listed",
    modules: [],
    ...overrides,
  }) as unknown as Course;

const offer = (code: string, experienceId: string, overrides: Partial<Row> = {}): Row => ({
  id: `offer-${code}`,
  experience_id: experienceId,
  code,
  mode: "checkout",
  amount: 4100,
  list_amount: null,
  currency: "UAH",
  access_days: null,
  access_lifetime: true,
  invoice_heading: null,
  invoice_description: null,
  share_pct: null,
  pixel_content_name: null,
  active: true,
  format: null,
  label: null,
  ...overrides,
});

beforeEach(() => {
  getLiveCourse.mockReset();
  getLiveCourse.mockImplementation(async (slug: string) => course(slug));
  db.failures = {};
  db.tables = {
    experiences: [
      { id: "exp-way21", kind: "course", slug: "way21", title: null },
      { id: "exp-reboot", kind: "mini", slug: "reboot", title: null },
      { id: "exp-irem", kind: "course", slug: "irem", title: null },
      { id: "exp-herbs", kind: "physical", slug: "herbs", title: "Фітозбір" },
      { id: "exp-consult", kind: "consultation", slug: "consult", title: "Консультація" },
    ],
    lms_courses: [
      { slug: "way21", program_slug: "way21", experience_id: "exp-way21", created_at: "2026-01-01" },
      { slug: "way21-en", program_slug: "way21", experience_id: "exp-way21", created_at: "2026-05-01" },
      { slug: "short", program_slug: "reboot", experience_id: "exp-reboot", created_at: "2026-01-01" },
      { slug: "irem-gymnastics", program_slug: "irem", experience_id: "exp-irem", created_at: "2026-01-01" },
    ],
    experience_offers: [
      offer("course:way21", "exp-way21", {
        pixel_content_name: "Way21 Detox",
        invoice_heading: { uk: "Шлях 21 — інтегративна детокс-програма", en: "Way 21 — integrative detox program" },
        invoice_description: { uk: "Оплата детокс-програми.", en: "Detox program payment." },
      }),
      offer("way21-group", "exp-way21", { format: "group", label: null }),
      offer("way21-support", "exp-way21", { mode: "lead", amount: 9000, format: "individual" }),
      offer("course:short", "exp-reboot", { amount: 795, pixel_content_name: "Short Reboot" }),
      offer("course:irem-gymnastics", "exp-irem", { amount: 3950, pixel_content_name: "IREM" }),
      offer("herbs", "exp-herbs", {
        amount: 1200,
        invoice_heading: { uk: "Фітозбір — індивідуальний підбір", en: "Herbal blend" },
      }),
      offer("consult", "exp-consult", { mode: "lead", amount: null }),
    ],
    offer_aliases: [
      { code: "way21", offer_id: "offer-course:way21" },
      { code: "detox21", offer_id: "offer-course:way21" },
      { code: "shlyah21", offer_id: "offer-course:way21" },
      { code: "short", offer_id: "offer-course:short" },
      { code: "reboot", offer_id: "offer-course:short" },
      { code: "irem", offer_id: "offer-course:irem-gymnastics" },
      { code: "way21_support", offer_id: "offer-way21-support" },
    ],
  };
});

describe("a legacy code", () => {
  it("is charged the row's price and filed under the offer's own code", async () => {
    const payable = await loadPayableOffer("way21");
    expect(payable).toMatchObject({
      code: "course:way21",
      amount: 4100,
      pixelContentName: "Way21 Detox",
      heading: { uk: "Шлях 21 — інтегративна детокс-програма" },
      fulfilment: { kind: "course", courseSlug: "way21", programSlug: "way21" },
    });
  });

  it("reaches the same offer as every other spelling of it", async () => {
    const canonical = await loadPayableOffer("course:way21");
    for (const spelling of ["way21", "WAY21", " detox21 ", "shlyah21"]) {
      expect(await loadPayableOffer(spelling), spelling).toEqual(canonical);
    }
  });

  it("delivers the row a program's name differs from", async () => {
    // Sold at /programs/reboot and /programs/irem, read at /learn/short and
    // /learn/irem-gymnastics — the reason fulfilment is a lookup, not the code.
    expect((await loadPayableOffer("reboot"))?.fulfilment).toEqual({
      kind: "course",
      courseSlug: "short",
      programSlug: "reboot",
    });
    expect((await loadPayableOffer("irem"))?.fulfilment).toMatchObject({ courseSlug: "irem-gymnastics" });
  });
});

describe("what refuses a checkout", () => {
  it("an unknown code — never someone else's product", async () => {
    for (const junk of ["nonsense", "", null, undefined, "course:", "course:../secret"]) {
      expect(await loadPayableOffer(junk), String(junk)).toBeNull();
    }
  });

  it("a withdrawn offer, through every door at once", async () => {
    db.tables.experience_offers!.find((row) => row.code === "course:way21")!.active = false;
    expect(await loadPayableOffer("way21")).toBeNull();
    expect(await loadPayableOffer("course:way21")).toBeNull();
  });

  it("a package sold as an enquiry, and a price «за запитом»", async () => {
    expect(await loadPayableOffer("way21-support")).toBeNull();
    expect(await loadPayableOffer("way21_support")).toBeNull();
    expect(await loadPayableOffer("consult")).toBeNull();
  });

  it("a course that is a draft or hidden", async () => {
    getLiveCourse.mockImplementation(async (slug: string) => course(slug, { status: "draft" } as Partial<Course>));
    expect(await loadPayableOffer("way21")).toBeNull();
    getLiveCourse.mockImplementation(async (slug: string) => course(slug, { visibility: "hidden" } as Partial<Course>));
    expect(await loadPayableOffer("way21")).toBeNull();
  });

  it("a price that cannot be read", async () => {
    db.failures = { "experience_offers:select": "boom" };
    expect(await loadPayableOffer("way21")).toBeNull();
  });
});

describe("offers that are not a course's own", () => {
  it("names a format in the invoice line when the owner wrote none", async () => {
    const payable = await loadPayableOffer("way21-group");
    expect(payable).toMatchObject({
      code: "way21-group",
      heading: { uk: "Title of way21 — у групі потоку — CenterWay" },
      fulfilment: { kind: "course", courseSlug: "way21", programSlug: "way21" },
    });
  });

  it("sells a thing with no course and delivers it to the cabinet", async () => {
    expect(await loadPayableOffer("herbs")).toMatchObject({
      code: "herbs",
      amount: 1200,
      heading: { uk: "Фітозбір — індивідуальний підбір" },
      pixelContentName: "Фітозбір",
      fulfilment: { kind: "cabinet" },
    });
    expect(getLiveCourse).not.toHaveBeenCalled();
  });
});
