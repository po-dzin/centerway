/**
 * The shelf nests what a bundle carried under the program that carried it.
 *
 * Guards `listLearnerCourses`' `includedIn` / `carries` (2026-09-25). A group
 * format of Шлях 21 opens Reset Day and Short too; on the shelf those two are
 * shown INSIDE Шлях 21, not as purchases of their own. The rules:
 *   · a course held only through a bundle (or a `bonus` seat) is nested under
 *     the open program whose linked module points at it;
 *   · a course the learner ALSO bought on its own keeps its own card;
 *   · a host that carries two bonuses names both;
 *   · a host that is no longer open (expired, revoked) nests nothing — the bonus
 *     is not hung under a card the learner cannot open.
 *
 * Runs server.ts for real over the in-memory fake, as accessWindow.test.ts
 * does; only the live catalog is stubbed.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { FakeSupabase, type Row } from "@/lib/admin/fakeSupabase";
import type { Course, CourseModule } from "@/lms-core";

const db = new FakeSupabase();
let catalog: Course[] = [];

vi.mock("@/lib/auth/adminClient", () => ({ adminClient: () => db }));
vi.mock("./liveCatalog", () => ({
  listLiveCourses: async () => catalog,
  getLiveCourse: async (slug: string) => catalog.find((entry) => entry.slug === slug) ?? null,
}));

const { listLearnerCourses } = await import("./server");

const NOW = new Date("2026-09-26T12:00:00.000Z");
const IDENTITY = { authUserId: "auth-1", email: "learner@example.com", emailVerified: true };

function lessons(id: string): CourseModule {
  return {
    id,
    slug: id,
    title: id,
    order: 1,
    lessons: [{ id: `${id}-l1`, slug: "l1", title: "L1", order: 1, blocks: [] }],
  };
}

function linked(slug: string, order: number): CourseModule {
  return { id: `link-${slug}`, slug: `link-${slug}`, title: slug, order, linkedCourseSlug: slug, lessons: [] };
}

function course(id: string, slug: string, title: string, modules: CourseModule[]): Course {
  return {
    id,
    slug,
    title,
    programSlug: slug,
    brand: "centerway",
    locale: "uk",
    translationGroupId: id,
    status: "published",
    version: 1,
    schedule: { mode: "open" },
    entitlementProductCodes: [],
    modules,
  } as Course;
}

const WAY21 = course("course-way21", "way21", "Шлях 21", [lessons("w"), linked("reset-day", 2), linked("short", 3)]);
const RESET = course("course-reset", "reset-day", "Reset Day", [lessons("r")]);
const SHORT = course("course-short", "short", "Short", [lessons("s")]);
const OTHER = course("course-other", "other", "Other", [lessons("o")]);

function order(ref: string, productCode: string, createdAt = "2026-09-20T09:00:00.000Z"): Row {
  return { order_ref: ref, product_code: productCode, status: "paid", customer_id: "cus-1", created_at: createdAt };
}

function enrollment(id: string, courseId: string, overrides: Row = {}): Row {
  return {
    id,
    course_id: courseId,
    auth_user_id: "auth-1",
    started_at: "2026-09-21T06:00:00.000Z",
    cohort_starts_on: null,
    source: "order",
    order_ref: null,
    expires_at: null,
    status: "active",
    revoked_at: null,
    blocked_at: null,
    ...overrides,
  };
}

function seed(input: { orders?: Row[]; enrollments?: Row[] } = {}) {
  catalog = [WAY21, RESET, SHORT, OTHER];
  db.tables = {
    lms_enrollments: input.enrollments ?? [],
    user_roles: [],
    platform_users: [{ auth_user_id: "auth-1", timezone: "Europe/Kyiv" }],
    customers: [{ id: "cus-1", email: "learner@example.com", auth_user_id: "auth-1" }],
    orders: input.orders ?? [],
    lms_courses: [
      { id: "course-way21", author_id: null, experience_id: "exp-way21" },
      { id: "course-reset", author_id: null, experience_id: "exp-reset" },
      { id: "course-short", author_id: null, experience_id: "exp-short" },
      { id: "course-other", author_id: null, experience_id: "exp-other" },
    ],
    experience_offers: [
      {
        id: "o-way21",
        experience_id: "exp-way21",
        code: "course:way21",
        access_days: null,
        access_lifetime: true,
        amount: 1000,
        active: true,
      },
      {
        id: "o-way21-group",
        experience_id: "exp-way21",
        code: "way21-group",
        access_days: null,
        access_lifetime: true,
        amount: 3000,
        active: true,
      },
      {
        id: "o-reset",
        experience_id: "exp-reset",
        code: "course:reset-day",
        access_days: null,
        access_lifetime: true,
        amount: 500,
        active: true,
      },
      {
        id: "o-short",
        experience_id: "exp-short",
        code: "course:short",
        access_days: null,
        access_lifetime: true,
        amount: 500,
        active: true,
      },
    ],
    offer_aliases: [],
    // What the view says: the group format opens Шлях 21 and carries the other two.
    course_opening_codes: [
      { course_id: "course-way21", code: "course:way21" },
      { course_id: "course-way21", code: "way21-group" },
      { course_id: "course-reset", code: "course:reset-day" },
      { course_id: "course-reset", code: "way21-group" },
      { course_id: "course-short", code: "course:short" },
      { course_id: "course-short", code: "way21-group" },
    ],
    access_tokens: [],
    lms_progress_events: [],
  };
  db.failures = {};
}

async function shelf() {
  const entries = await listLearnerCourses(IDENTITY, NOW);
  return new Map(entries.map((entry) => [entry.course.slug, entry]));
}

beforeEach(() => seed());

describe("listLearnerCourses — nesting what a bundle carried", () => {
  it("nests both bonuses of the group format under Шлях 21, and the host names them", async () => {
    seed({
      orders: [order("ord-group", "way21-group")],
      enrollments: [enrollment("enr-way21", "course-way21", { order_ref: "ord-group" })],
    });

    const entries = await shelf();

    expect(entries.get("way21")).toMatchObject({ access: "enrolled", includedIn: null });
    expect(entries.get("way21")?.carries).toEqual([
      { slug: "reset-day", title: "Reset Day" },
      { slug: "short", title: "Short" },
    ]);
    for (const slug of ["reset-day", "short"]) {
      expect(entries.get(slug)).toMatchObject({
        access: "available",
        includedIn: { slug: "way21", title: "Шлях 21" },
        carries: [],
      });
    }
    // Something nobody bought is neither nested nor a host.
    expect(entries.get("other")).toMatchObject({ access: "locked", includedIn: null, carries: [] });
  });

  it("keeps a course bought on its own as its own card, even when the bundle also carries it", async () => {
    seed({
      orders: [order("ord-group", "way21-group"), order("ord-reset", "course:reset-day", "2026-09-21T09:00:00.000Z")],
      enrollments: [
        enrollment("enr-way21", "course-way21", { order_ref: "ord-group" }),
        enrollment("enr-reset", "course-reset", { order_ref: "ord-group" }),
      ],
    });

    const entries = await shelf();

    expect(entries.get("reset-day")).toMatchObject({ access: "enrolled", includedIn: null });
    expect(entries.get("short")?.includedIn).toEqual({ slug: "way21", title: "Шлях 21" });
    expect(entries.get("way21")?.carries).toEqual([{ slug: "short", title: "Short" }]);
  });

  it("nests a seat handed out as a bonus, with no order behind it", async () => {
    seed({
      orders: [order("ord-self", "course:way21")],
      enrollments: [
        enrollment("enr-way21", "course-way21", { order_ref: "ord-self" }),
        enrollment("enr-reset", "course-reset", { source: "bonus" }),
      ],
    });

    const entries = await shelf();

    expect(entries.get("reset-day")).toMatchObject({
      access: "enrolled",
      includedIn: { slug: "way21", title: "Шлях 21" },
    });
    // Self-paced buyer: Short was never carried in, so it is simply locked.
    expect(entries.get("short")).toMatchObject({ access: "locked", includedIn: null });
    expect(entries.get("way21")?.carries).toEqual([{ slug: "reset-day", title: "Reset Day" }]);
  });

  it("does not nest a bundle course under a program that does not link to it", async () => {
    seed({
      orders: [order("ord-group", "way21-group")],
      enrollments: [enrollment("enr-way21", "course-way21", { order_ref: "ord-group" })],
    });
    catalog = [{ ...WAY21, modules: [lessons("w")] } as Course, RESET, SHORT, OTHER];

    const entries = await shelf();

    expect(entries.get("reset-day")).toMatchObject({ access: "available", includedIn: null });
    expect(entries.get("way21")?.carries).toEqual([]);
  });

  describe("when the host is no longer open", () => {
    it("an expired host nests nothing", async () => {
      seed({
        orders: [order("ord-self", "course:way21", "2026-07-01T09:00:00.000Z")],
        enrollments: [
          enrollment("enr-way21", "course-way21", { order_ref: "ord-self", expires_at: "2026-08-01T09:00:00.000Z" }),
          enrollment("enr-reset", "course-reset", { source: "bonus" }),
        ],
      });

      const entries = await shelf();

      expect(entries.get("way21")).toMatchObject({ access: "locked", lockReason: "expired", carries: [] });
      // The bonus is still the learner's; it simply stands on its own.
      expect(entries.get("reset-day")).toMatchObject({ access: "enrolled", includedIn: null });
    });

    it("a revoked host nests nothing", async () => {
      seed({
        orders: [order("ord-group", "way21-group")],
        enrollments: [
          enrollment("enr-way21", "course-way21", {
            order_ref: "ord-group",
            status: "revoked",
            revoked_at: "2026-09-22T00:00:00.000Z",
          }),
        ],
      });

      const entries = await shelf();

      expect(entries.get("way21")).toMatchObject({ access: "locked", lockReason: "revoked", carries: [] });
      for (const slug of ["reset-day", "short"]) {
        expect(entries.get(slug)?.includedIn).toBeNull();
      }
    });

    it("an expired or revoked BONUS is not nested either", async () => {
      seed({
        orders: [order("ord-self", "course:way21")],
        enrollments: [
          enrollment("enr-way21", "course-way21", { order_ref: "ord-self" }),
          enrollment("enr-reset", "course-reset", { source: "bonus", expires_at: "2026-09-01T00:00:00.000Z" }),
        ],
      });

      const entries = await shelf();

      expect(entries.get("reset-day")).toMatchObject({ access: "locked", includedIn: null });
      expect(entries.get("way21")?.carries).toEqual([]);
    });
  });
});
