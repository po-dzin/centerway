import { describe, expect, it } from "vitest";

import {
  aggregateReferrals,
  type ReferralEnrollmentRow,
  type ReferralLookups,
  type ReferralOrderRow,
  type ReferralReport,
} from "./referrals";

function firstTag(report: ReferralReport) {
  const tag = report.tags[0];
  if (!tag) throw new Error("expected at least one tag");
  return tag;
}

function firstPerson(report: ReferralReport) {
  const person = firstTag(report).people_list[0];
  if (!person) throw new Error("expected at least one person");
  return person;
}

function lookups(overrides: Partial<ReferralLookups> = {}): ReferralLookups {
  return {
    accountEmail: new Map([
      ["u-anna", "anna@example.com"],
      ["u-bohdan", "bohdan@example.com"],
      ["u-iryna", "iryna@example.com"],
    ]),
    customers: new Map([
      ["c-anna", { authUserId: "u-anna", email: "anna@example.com" }],
      ["c-guest", { authUserId: null, email: "Guest@Example.com" }],
      ["c-iryna-unlinked", { authUserId: null, email: "iryna@example.com" }],
    ]),
    courses: new Map([
      ["id-way21", { key: "course:way21", title: "Шлях 21" }],
      ["id-short", { key: "course:short", title: "Short Reboot" }],
    ]),
    orderEnrollment: new Map(),
    product: (code) =>
      code === "course:way21" || code === "way21"
        ? { key: "course:way21", title: "Шлях 21" }
        : { key: code ?? "unknown", title: null },
    ...overrides,
  };
}

function enrollment(overrides: Partial<ReferralEnrollmentRow>): ReferralEnrollmentRow {
  return {
    auth_user_id: "u-anna",
    course_id: "id-way21",
    ref: "olena",
    source: "free",
    order_ref: null,
    created_at: "2026-09-20T10:00:00.000Z",
    ...overrides,
  };
}

function order(overrides: Partial<ReferralOrderRow>): ReferralOrderRow {
  return {
    order_ref: "ord-1",
    ref: "olena",
    status: "paid",
    amount: 1500,
    currency: "UAH",
    created_at: "2026-09-21T10:00:00.000Z",
    customer_id: "c-anna",
    product_code: "course:way21",
    ...overrides,
  };
}

describe("aggregateReferrals", () => {
  it("counts a paying person once when both the order and the enrollment carry the tag", () => {
    // The ordinary paid path writes the tag twice: on the order at checkout,
    // and on the enrollment the order becomes. That is one person, not two.
    const report = aggregateReferrals(
      [enrollment({ source: "order", order_ref: "ord-1", created_at: "2026-09-22T08:00:00.000Z" })],
      [order({})],
      lookups({ orderEnrollment: new Map([["ord-1", { authUserId: "u-anna", courseId: "id-way21" }]]) }),
    );

    expect(report.tags).toHaveLength(1);
    const olena = firstTag(report);
    expect(olena).toMatchObject({ ref: "olena", people: 1, paid_people: 1, free_people: 0, paid_orders: 1 });
    expect(olena.revenue).toEqual([{ currency: "UAH", amount: 1500 }]);
    expect(olena.people_list).toEqual([
      {
        email: "anna@example.com",
        course_key: "course:way21",
        course_title: "Шлях 21",
        at: "2026-09-21T10:00:00.000Z",
        paid: true,
        order_ref: "ord-1",
      },
    ]);
  });

  it("matches an order nobody has opened yet to the enrollment through its product code", () => {
    // No linked enrollment: the course comes from the product identity and the
    // person from the customer row, and they still fold with a later free seat
    // on the same course rather than doubling.
    const report = aggregateReferrals([enrollment({ source: "free" })], [order({ product_code: "way21" })], lookups());
    expect(firstTag(report)).toMatchObject({ people: 1, paid_people: 1, free_people: 0 });
  });

  it("counts the same person on two courses twice, once per course", () => {
    const report = aggregateReferrals(
      [enrollment({}), enrollment({ course_id: "id-short", created_at: "2026-09-25T10:00:00.000Z" })],
      [],
      lookups(),
    );
    expect(firstTag(report)).toMatchObject({ people: 2, free_people: 2, paid_people: 0 });
    // Newest first, the way a list of arrivals is read.
    expect(firstTag(report).people_list.map((p) => p.course_key)).toEqual(["course:short", "course:way21"]);
  });

  it("separates free and paid people, and paid orders from paid people", () => {
    const report = aggregateReferrals(
      [
        enrollment({ auth_user_id: "u-bohdan", source: "free" }),
        // A manual grant is not a sale.
        enrollment({ auth_user_id: "u-iryna", source: "manual" }),
      ],
      [
        order({ order_ref: "ord-1", amount: 1500 }),
        // A second purchase by the same person for the same course: one person,
        // two orders, both paid for.
        order({ order_ref: "ord-2", amount: 500, created_at: "2026-09-23T10:00:00.000Z" }),
      ],
      lookups(),
    );
    expect(firstTag(report)).toMatchObject({ people: 3, paid_people: 1, free_people: 2, paid_orders: 2 });
    expect(firstTag(report).revenue).toEqual([{ currency: "UAH", amount: 2000 }]);
  });

  it("keeps revenue apart by currency and treats a missing currency as hryvnias", () => {
    const report = aggregateReferrals(
      [],
      [
        order({ order_ref: "ord-1", amount: 1000, currency: null }),
        order({ order_ref: "ord-2", amount: 30, currency: "eur", customer_id: "c-guest" }),
        order({ order_ref: "ord-3", amount: 200.5, currency: "UAH", customer_id: "c-guest" }),
      ],
      lookups(),
    );
    expect(firstTag(report).revenue).toEqual([
      { currency: "UAH", amount: 1200.5 },
      { currency: "EUR", amount: 30 },
    ]);
    expect(report.totals.revenue).toEqual(firstTag(report).revenue);
  });

  it("ignores an unpaid order even if one slips through the query", () => {
    const report = aggregateReferrals([], [order({ status: "pending" }), order({ ref: null })], lookups());
    expect(report.tags).toEqual([]);
    expect(report.totals).toMatchObject({ tags: 0, people: 0, paid_orders: 0, revenue: [] });
  });

  it("recognises a buyer by email when the customer row was never linked to the account", () => {
    // Iryna paid as a guest under the email she later signed in with; the
    // enrollment she then opened is the same person, not a second arrival.
    const report = aggregateReferrals(
      [enrollment({ auth_user_id: "u-iryna", source: "order", order_ref: null })],
      [order({ customer_id: "c-iryna-unlinked" })],
      lookups(),
    );
    expect(firstTag(report)).toMatchObject({ people: 1, paid_people: 1 });
    expect(firstPerson(report).email).toBe("iryna@example.com");
  });

  it("falls back to the customer's email for a guest buyer with no account", () => {
    const report = aggregateReferrals([], [order({ customer_id: "c-guest" })], lookups());
    expect(firstPerson(report)).toMatchObject({ email: "Guest@Example.com", paid: true });
  });

  it("reports each tag on its own row, ordered by people, with its first and last arrival", () => {
    const report = aggregateReferrals(
      [
        enrollment({ ref: "taras", auth_user_id: "u-bohdan", created_at: "2026-09-10T10:00:00.000Z" }),
        enrollment({ ref: "olena", auth_user_id: "u-anna", created_at: "2026-09-12T10:00:00.000Z" }),
        enrollment({ ref: "olena", auth_user_id: "u-iryna", created_at: "2026-09-28T10:00:00.000Z" }),
      ],
      [],
      lookups(),
    );
    expect(report.tags.map((tag) => [tag.ref, tag.people])).toEqual([
      ["olena", 2],
      ["taras", 1],
    ]);
    expect(firstTag(report)).toMatchObject({
      first_at: "2026-09-12T10:00:00.000Z",
      last_at: "2026-09-28T10:00:00.000Z",
    });
    expect(report.totals).toMatchObject({ tags: 2, people: 3, free_people: 3, paid_people: 0 });
  });

  it("shows a person under both tags when their order and enrollment disagree", () => {
    // Deliberately not resolved: guessing which tag is right would hide the
    // disagreement, and the operator who typed a tag on a grant should see it.
    const report = aggregateReferrals(
      [enrollment({ ref: "taras", source: "order", order_ref: "ord-1" })],
      [order({})],
      lookups({ orderEnrollment: new Map([["ord-1", { authUserId: "u-anna", courseId: "id-way21" }]]) }),
    );
    expect(report.tags.map((tag) => tag.ref).sort()).toEqual(["olena", "taras"]);
    expect(report.tags.find((tag) => tag.ref === "taras")?.paid_orders).toBe(0);
  });
});
