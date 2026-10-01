import { describe, expect, it } from "vitest";

import { planAccess, seatRefunded, type AccessPlanInput } from "./access";

const DAY_MS = 24 * 60 * 60 * 1000;

function order(orderRef: string, createdAt: string) {
  return { orderRef, productCode: "course:demo", status: "approved", createdAt };
}

const NOW = new Date("2026-09-01T00:00:00.000Z");
const BASE: AccessPlanInput = {
  orders: [],
  rule: { lifetime: false, days: 30 },
  now: NOW,
  existing: null,
};

describe("planAccess — stacking purchases separated by more than one term", () => {
  it("rebases a late renewal on its own payment instead of the first purchase", () => {
    // Two 30-day purchases six months apart. A window anchored to February and
    // simply given 60 days (2 * 30) would land in early April — already in the
    // past by the time the second, August payment happens — so the repurchase
    // would fail to reopen the course even though it should.
    const plan = planAccess({
      ...BASE,
      orders: [order("feb", "2026-02-01T00:00:00.000Z"), order("aug", "2026-08-01T00:00:00.000Z")],
    });

    expect(plan.grant).toBe(true);
    if (!plan.grant) return;
    // The window must run 30 days from the AUGUST payment, not from February.
    expect(plan.expiresAt).toBe(new Date(Date.parse("2026-08-01T00:00:00.000Z") + 30 * DAY_MS).toISOString());
    // The bug this guards against: anchoring both terms to February would put
    // the deadline in early April, months before this August payment happened.
    expect(Date.parse(plan.expiresAt!)).toBeGreaterThan(Date.parse("2026-08-01T00:00:00.000Z"));
  });

  it("still stacks two purchases that arrive before the first window lapses", () => {
    // The case the brief explicitly protects: buying again early adds to what
    // is left rather than restarting from the second payment.
    const plan = planAccess({
      ...BASE,
      orders: [order("a", "2026-08-01T00:00:00.000Z"), order("b", "2026-08-10T00:00:00.000Z")],
    });

    expect(plan.grant).toBe(true);
    if (!plan.grant) return;
    expect(plan.expiresAt).toBe(new Date(Date.parse("2026-08-01T00:00:00.000Z") + 60 * DAY_MS).toISOString());
  });

  it("rebases every purchase in a chain of more than two lapsed windows", () => {
    const plan = planAccess({
      ...BASE,
      orders: [
        order("jan", "2026-01-01T00:00:00.000Z"),
        order("mar", "2026-03-01T00:00:00.000Z"),
        order("aug", "2026-08-01T00:00:00.000Z"),
      ],
    });

    expect(plan.grant).toBe(true);
    if (!plan.grant) return;
    expect(plan.expiresAt).toBe(new Date(Date.parse("2026-08-01T00:00:00.000Z") + 30 * DAY_MS).toISOString());
  });
});

describe("seatRefunded — a refund closes the seat it paid for (meta-audit 2026-09-30, N1)", () => {
  const order = (orderRef: string, status: string, createdAt = "2026-09-01T10:00:00Z") => ({
    orderRef,
    productCode: "course:way21",
    status,
    createdAt,
  });

  it("closes a seat whose anchoring order now reads refunded", () => {
    expect(seatRefunded({ source: "order", orderRef: "a", orders: [order("a", "refunded")], accepted: [] })).toBe(true);
  });

  it("keeps the seat while another paid order for the course still stands", () => {
    const paid = order("b", "paid", "2026-09-10T10:00:00Z");
    expect(
      seatRefunded({ source: "order", orderRef: "a", orders: [order("a", "refunded"), paid], accepted: [paid] }),
    ).toBe(false);
  });

  it("keeps the seat while its order is still paid", () => {
    const paid = order("a", "paid");
    expect(seatRefunded({ source: "order", orderRef: "a", orders: [paid], accepted: [paid] })).toBe(false);
  });

  it("reads a row with no source as a purchase", () => {
    expect(seatRefunded({ source: null, orderRef: "a", orders: [order("a", "refunded")], accepted: [] })).toBe(true);
  });

  it("never closes a seat no payment opened", () => {
    for (const source of ["manual", "bonus", "free", "promotion"]) {
      expect(seatRefunded({ source, orderRef: "a", orders: [order("a", "refunded")], accepted: [] })).toBe(false);
    }
  });

  it("leaves alone a seat whose anchor it cannot see", () => {
    expect(seatRefunded({ source: "order", orderRef: "elsewhere", orders: [], accepted: [] })).toBe(false);
    expect(seatRefunded({ source: "order", orderRef: null, orders: [order("a", "refunded")], accepted: [] })).toBe(
      false,
    );
  });
});
