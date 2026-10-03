/**
 * The storefront's reading of a price: the `course:<slug>` namespace, which
 * course is public, and — since formats (2026-09-25) — the one door from ANY
 * code to a payable offer and the catalogue card that quotes a program sold
 * several ways.
 *
 * The format cases guard the two ways formats could leak money: a cohort code
 * (`way21-group`) charged at the wrong figure or filed under the course's code,
 * and a lead or unapproved format opening a checkout — or an unknown code
 * falling back to someone else's product.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { FakeSupabase, type Row } from "@/lib/admin/fakeSupabase";
import type { ProgramFormat } from "@/lib/experiences/formats";
import type { Course } from "@/lms-core";

const hoisted = vi.hoisted(() => ({
  db: null as unknown as FakeSupabase,
  liveCourses: new Map<string, unknown>(),
  formats: new Map<string, unknown[]>(),
}));
hoisted.db = new FakeSupabase();
const db = hoisted.db;

vi.mock("@/lib/supabaseAdmin", () => ({ supabaseAdmin: () => hoisted.db }));
vi.mock("next/cache", () => ({ unstable_cache: (fn: () => unknown) => fn }));
vi.mock("@/lib/lms/liveCatalog", () => ({
  COURSE_LIST_TAG: "lms-courses",
  courseTag: (slug: string) => `lms-course:${slug}`,
  getLiveCourse: async (slug: string) => hoisted.liveCourses.get(slug) ?? null,
  listLiveCourses: async () => [...hoisted.liveCourses.values()],
}));
vi.mock("@/lib/experiences/formats", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/experiences/formats")>()),
  loadProgramFormats: async (course: { slug: string }) => hoisted.formats.get(course.slug) ?? [],
}));

import {
  courseOfferCode,
  isPublicCourse,
  listStorefrontCourses,
  loadPayableOffer,
  parseCourseOfferCode,
} from "./offers";

const course = (over: Partial<Course>): Course => ({ status: "published", ...over }) as Course;

describe("course offer codes", () => {
  it("round-trips a slug", () => {
    expect(parseCourseOfferCode(courseOfferCode("way21"))).toBe("way21");
    expect(parseCourseOfferCode(courseOfferCode("reset-day"))).toBe("reset-day");
  });

  it("refuses anything that is not a course code", () => {
    // The hand-written product codes must never resolve through this door.
    expect(parseCourseOfferCode("short")).toBeNull();
    expect(parseCourseOfferCode("way21")).toBeNull();
    expect(parseCourseOfferCode(undefined)).toBeNull();
    expect(parseCourseOfferCode(42)).toBeNull();
  });

  it("refuses a slug that is not slug-shaped, because it becomes a lookup", () => {
    expect(parseCourseOfferCode("course:")).toBeNull();
    expect(parseCourseOfferCode("course:Way21")).toBeNull();
    expect(parseCourseOfferCode("course:a b")).toBeNull();
    expect(parseCourseOfferCode("course:../secret")).toBeNull();
    expect(parseCourseOfferCode("course:-lead")).toBeNull();
    expect(parseCourseOfferCode("course:trail-")).toBeNull();
  });
});

describe("isPublicCourse", () => {
  it("keeps a draft private whatever its visibility claims", () => {
    expect(isPublicCourse(course({ status: "draft", visibility: "listed" }))).toBe(false);
  });

  it("treats a missing visibility as hidden", () => {
    expect(isPublicCourse(course({}))).toBe(false);
  });

  it("lets a published course out only as far as it was told to go", () => {
    expect(isPublicCourse(course({ visibility: "unlisted" }))).toBe(true);
    expect(isPublicCourse(course({ visibility: "listed" }))).toBe(true);
    expect(isPublicCourse(course({ visibility: "hidden" }))).toBe(false);
  });

  it("narrows to the catalogue when asked", () => {
    expect(isPublicCourse(course({ visibility: "unlisted" }), ["listed"])).toBe(false);
    expect(isPublicCourse(course({ visibility: "listed" }), ["listed"])).toBe(true);
  });
});

/* ------------------------------------------------------------------------- */

const offerRow = (over: Partial<Row>): Row => ({
  id: "offer-way21",
  experience_id: "exp-way21",
  code: "course:way21",
  mode: "checkout",
  amount: 1795,
  list_amount: null,
  currency: "UAH",
  access_days: null,
  access_lifetime: true,
  invoice_heading: null,
  invoice_description: null,
  share_pct: null,
  pixel_content_name: "Way21 Detox",
  active: true,
  format: null,
  label: null,
  ...over,
});

const liveCourse = (over: Partial<Course> = {}): Course =>
  ({
    id: "c-way21",
    slug: "way21",
    programSlug: "way21",
    title: "Шлях 21",
    status: "published",
    visibility: "listed",
    locale: "uk",
    modules: [],
    schedule: { mode: "daily" },
    ...over,
  }) as unknown as Course;

const format = (over: Partial<ProgramFormat>): ProgramFormat => ({
  code: "course:way21",
  format: "self",
  label: "Самостійно",
  summary: null,
  features: [],
  mode: "checkout",
  amount: 1795,
  listAmount: null,
  currency: "UAH",
  cohortStartsOn: null,
  featured: false,
  includes: [],
  ...over,
});

beforeEach(() => {
  db.tables = {
    experience_offers: [
      offerRow({}),
      offerRow({
        id: "offer-group",
        code: "way21-group",
        amount: 4100,
        format: "group",
        label: { uk: "У групі потоку 01.10" },
        pixel_content_name: null,
      }),
      offerRow({ id: "offer-support", code: "way21-support", mode: "lead", amount: null, format: "individual" }),
      // What an author's unreviewed proposal looks like to the checkout: the
      // database refuses `active` on anything not approved.
      offerRow({ id: "offer-draft", code: "way21-duo", amount: 2500, format: "group", active: false }),
    ],
    offer_aliases: [],
    experiences: [{ id: "exp-way21", kind: "course", slug: "way21", title: "Шлях 21" }],
    lms_courses: [{ slug: "way21", program_slug: "way21", experience_id: "exp-way21", created_at: "2026-01-01" }],
  };
  db.failures = {};
  hoisted.liveCourses.clear();
  hoisted.liveCourses.set("way21", liveCourse());
  hoisted.formats.clear();
});

describe("loadPayableOffer — formats of a program", () => {
  it("charges a checkout format at its own amount, under its own code, delivered as its program", async () => {
    const offer = await loadPayableOffer("way21-group");
    expect(offer).toMatchObject({
      code: "way21-group",
      amount: 4100,
      currency: "UAH",
      fulfilment: { kind: "course", courseSlug: "way21", programSlug: "way21" },
    });
    // The invoice says which format was bought, in the author's words.
    expect(offer!.heading.uk).toBe("Шлях 21 — у групі потоку 01.10 — CenterWay");
    // No agreed label for Meta: the course title, never the self-paced product's.
    expect(offer!.pixelContentName).toBe("Шлях 21");
  });

  it("names an unlabelled format by its default label", async () => {
    db.tables.experience_offers![1]!.label = null;
    const offer = await loadPayableOffer("way21-group");
    expect(offer!.heading.uk).toBe("Шлях 21 — у групі потоку — CenterWay");
  });

  it("keeps the course's own self-paced code at its own price", async () => {
    expect(await loadPayableOffer("course:way21")).toMatchObject({ code: "course:way21", amount: 1795 });
  });

  it("does not open a checkout for a lead format", async () => {
    expect(await loadPayableOffer("way21-support")).toBeNull();
  });

  it("does not open a checkout for an unapproved, inactive format", async () => {
    expect(await loadPayableOffer("way21-duo")).toBeNull();
  });

  it("answers null to an unknown code rather than any other product", async () => {
    expect(await loadPayableOffer("way21-vip")).toBeNull();
    expect(await loadPayableOffer("short")).toBeNull();
    expect(await loadPayableOffer(undefined)).toBeNull();
  });

  it("refuses a format of a program that is not public", async () => {
    hoisted.liveCourses.set("way21", liveCourse({ status: "draft" } as Partial<Course>));
    expect(await loadPayableOffer("way21-group")).toBeNull();
  });

  it("refuses when the price cannot be read — a failed read is not a price", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    db.failures = { "experience_offers:select": "boom" };
    expect(await loadPayableOffer("way21-group")).toBeNull();
  });
});

describe("listStorefrontCourses — a card for a program sold in formats", () => {
  it("quotes «від» the lowest checkout price when the program has two or more formats", async () => {
    hoisted.formats.set("way21", [
      format({ code: "way21-group", format: "group", amount: 4100 }),
      format({}),
      format({ code: "way21-support", format: "individual", mode: "lead", amount: null }),
    ]);
    const [card] = await listStorefrontCourses();
    expect(card).toMatchObject({
      slug: "way21",
      commercialMode: "fixed",
      price: expect.stringMatching(/^від 1[\s\u00a0\u202f]?795/),
      amount: 1795,
      currency: "UAH",
      compareAtPrice: null,
    });
  });

  it("ignores a lead's missing figure and a free format when picking the lowest", async () => {
    hoisted.formats.set("way21", [
      format({ code: "way21-support", format: "individual", mode: "lead", amount: null }),
      format({ code: "way21-free", format: "self", mode: "free", amount: 0 }),
      format({ code: "way21-group", format: "group", amount: 4100 }),
    ]);
    const [card] = await listStorefrontCourses();
    expect(card).toMatchObject({ amount: 4100, price: expect.stringMatching(/^від 4/) });
  });

  it("leaves a single-format program exactly as its own offer prints it", async () => {
    db.tables.experience_offers![0]!.list_amount = 2400;
    hoisted.formats.set("way21", [format({})]);
    const [card] = await listStorefrontCourses();
    expect(card!.price).not.toMatch(/від/);
    expect(card).toMatchObject({ commercialMode: "fixed", amount: 1795, compareAtPrice: expect.stringMatching(/2/) });
  });

  it("leaves a program with no formats on its own offer", async () => {
    const [card] = await listStorefrontCourses();
    expect(card).toMatchObject({ commercialMode: "fixed", amount: 1795 });
    expect(card!.price).not.toMatch(/від/);
  });
});
