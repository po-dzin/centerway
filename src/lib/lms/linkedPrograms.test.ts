/**
 * «Додаткові програми» — the programs a course carries inside it.
 *
 * Guards `loadLinkedPrograms`: a linked module (`linkedCourseSlug`) is shown as
 * a card for the program it points at, and the card's lock is the LEARNER's own
 * access to THAT program — never the parent's. Stated as the brief states it:
 *   · the self-paced Шлях 21 buyer sees Reset Day and finds it locked;
 *   · the group buyer (a format whose offer carries Reset Day) finds it open;
 *   · someone who bought Reset Day on its own finds it open too;
 *   · a linked program that is gone or unpublished is not shown at all.
 *
 * Entitlement runs for real against the in-memory fake — only the catalog is
 * stubbed — so "open" here means what the door would say.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { FakeSupabase, type Row } from "@/lib/admin/fakeSupabase";
import type { Course, CourseModule } from "@/lms-core";

const db = new FakeSupabase();
const catalog = new Map<string, Course>();

vi.mock("@/lib/auth/adminClient", () => ({ adminClient: () => db }));
vi.mock("./liveCatalog", () => ({
  getLiveCourse: async (slug: string) => catalog.get(slug) ?? null,
  listLiveCourses: async () => [...catalog.values()],
}));

const { loadLinkedPrograms } = await import("./linkedPrograms");

const NOW = new Date("2026-09-26T12:00:00.000Z");
const IDENTITY = { authUserId: "auth-1", email: "learner@example.com", emailVerified: true };

function lessonModule(id: string, order: number, lessons = 1): CourseModule {
  return {
    id,
    slug: id,
    title: id,
    order,
    lessons: Array.from({ length: lessons }, (_, index) => ({
      id: `${id}-l${index + 1}`,
      slug: `${id}-l${index + 1}`,
      title: `${id} ${index + 1}`,
      order: index + 1,
      blocks: [],
    })),
  };
}

function linkedModule(id: string, order: number, slug: string, title = id): CourseModule {
  return { id, slug: id, title, order, linkedCourseSlug: slug, lessons: [] };
}

function course(overrides: Partial<Course> & Pick<Course, "id" | "slug">): Course {
  return {
    title: overrides.slug,
    programSlug: overrides.slug,
    brand: "centerway",
    locale: "uk",
    translationGroupId: overrides.id,
    status: "published",
    version: 1,
    schedule: { mode: "open" },
    entitlementProductCodes: [],
    modules: [lessonModule(`${overrides.id}-m1`, 1, 2)],
    ...overrides,
  } as Course;
}

const WAY21 = course({
  id: "course-way21",
  slug: "way21",
  title: "Шлях 21",
  modules: [
    lessonModule("w-m1", 1, 3),
    // Out of order on purpose: the cards follow module order, not array order.
    linkedModule("w-short", 3, "short", "Коротка практика"),
    linkedModule("w-reset", 2, "reset-day", "Розвантажувальний день"),
  ],
});

const RESET = course({
  id: "course-reset",
  slug: "reset-day",
  title: "Reset Day",
  programSlug: "reset-day-program",
  kind: "mini",
  cover: { src: "/reset.webp", alt: "Reset", mobileSrc: "/reset-mobile.webp" },
  modules: [lessonModule("r-m1", 1, 4), { ...lessonModule("r-ref", 2, 5), reference: true }],
} as Partial<Course> & Pick<Course, "id" | "slug">);

const SHORT = course({ id: "course-short", slug: "short", title: "Short" });

function order(ref: string, productCode: string): Row {
  return {
    order_ref: ref,
    product_code: productCode,
    status: "paid",
    customer_id: "cus-1",
    created_at: "2026-09-20T09:00:00.000Z",
  };
}

function seed(orders: Row[] = []) {
  catalog.clear();
  for (const entry of [WAY21, RESET, SHORT]) catalog.set(entry.slug, entry);
  db.tables = {
    user_roles: [],
    customers: [{ id: "cus-1", email: "learner@example.com", auth_user_id: "auth-1" }],
    orders,
    experience_offers: [],
    lms_enrollments: [],
    // The group format of Шлях 21 opens its own course AND carries both bonuses.
    course_opening_codes: [
      { course_id: "course-way21", code: "course:way21" },
      { course_id: "course-way21", code: "way21-group" },
      { course_id: "course-reset", code: "course:reset-day" },
      { course_id: "course-reset", code: "way21-group" },
      { course_id: "course-short", code: "course:short" },
      { course_id: "course-short", code: "way21-group" },
    ],
  };
  db.failures = {};
}

beforeEach(() => seed());

describe("loadLinkedPrograms", () => {
  it("returns nothing for a course with no linked modules, without touching the catalog", async () => {
    const getSpy = vi.fn();
    catalog.get = getSpy as never;
    expect(await loadLinkedPrograms(IDENTITY, SHORT, NOW)).toEqual([]);
    expect(getSpy).not.toHaveBeenCalled();
    catalog.get = Map.prototype.get;
  });

  it("describes each linked program in module order, from the linked course's own data", async () => {
    const cards = await loadLinkedPrograms(IDENTITY, WAY21, NOW);

    expect(cards.map((card) => card.courseSlug)).toEqual(["reset-day", "short"]);
    expect(cards[0]).toEqual({
      moduleId: "w-reset",
      // The parent author's name for it, next to the program's own title.
      title: "Розвантажувальний день",
      courseSlug: "reset-day",
      programSlug: "reset-day-program",
      courseTitle: "Reset Day",
      kind: "mini",
      // Steps only: the reference module's five lookups are not lessons.
      lessonCount: 4,
      // The portrait master wins for a card.
      cover: { src: "/reset-mobile.webp", alt: "Reset" },
      access: "locked",
    });
    expect(cards[1]).toMatchObject({ kind: null, cover: null, lessonCount: 2 });
  });

  it("keeps the linked program locked for someone who bought only the self-paced parent", async () => {
    seed([order("ord-self", "course:way21")]);
    const cards = await loadLinkedPrograms(IDENTITY, WAY21, NOW);
    expect(cards.map((card) => card.access)).toEqual(["locked", "locked"]);
  });

  it("opens both for the group buyer — the format's offer carries them", async () => {
    seed([order("ord-group", "way21-group")]);
    const cards = await loadLinkedPrograms(IDENTITY, WAY21, NOW);
    expect(cards.map((card) => card.access)).toEqual(["open", "open"]);
  });

  it("opens only the program a learner bought on its own", async () => {
    seed([order("ord-reset", "course:reset-day")]);
    const cards = await loadLinkedPrograms(IDENTITY, WAY21, NOW);
    expect(cards.map((card) => [card.courseSlug, card.access])).toEqual([
      ["reset-day", "open"],
      ["short", "locked"],
    ]);
  });

  it("shows every card locked to a signed-out visitor, with no entitlement read", async () => {
    seed([order("ord-group", "way21-group")]);
    const cards = await loadLinkedPrograms(null, WAY21, NOW);
    expect(cards.map((card) => card.access)).toEqual(["locked", "locked"]);
  });

  it("drops a linked program that is unpublished, missing, or fails to load", async () => {
    seed([order("ord-group", "way21-group")]);
    catalog.set("reset-day", { ...RESET, status: "draft" } as Course);
    catalog.delete("short");
    expect(await loadLinkedPrograms(IDENTITY, WAY21, NOW)).toEqual([]);

    const withBroken = { ...WAY21, modules: [...WAY21.modules, linkedModule("w-broken", 4, "broken")] } as Course;
    catalog.set("reset-day", RESET);
    const originalGet = catalog.get.bind(catalog);
    catalog.get = ((slug: string) => {
      if (slug === "broken") throw new Error("catalog down");
      return originalGet(slug);
    }) as never;
    const cards = await loadLinkedPrograms(IDENTITY, withBroken, NOW);
    catalog.get = Map.prototype.get;
    expect(cards.map((card) => card.courseSlug)).toEqual(["reset-day"]);
  });

  it("fails closed: a purchases read that errors shows the cards locked, not the reader broken", async () => {
    seed([order("ord-group", "way21-group")]);
    db.failures = { "orders:select": "boom" };
    const cards = await loadLinkedPrograms(IDENTITY, WAY21, NOW);
    expect(cards.map((card) => card.access)).toEqual(["locked", "locked"]);
  });
});
