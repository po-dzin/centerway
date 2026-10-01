import { describe, expect, it } from "vitest";

import { planAccess, refundedSeat, type AccessPlanInput } from "./access";

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

describe("refundedSeat — a refund closes the seat it paid for (meta-audit 2026-09-30, N1)", () => {
  const order = (orderRef: string, status: string, createdAt = "2026-08-20T10:00:00Z") => ({
    orderRef,
    productCode: "course:way21",
    status,
    createdAt,
  });
  const MONTH = { lifetime: false as const, days: 30 };
  const seat = (input: Partial<Parameters<typeof refundedSeat>[0]>) =>
    refundedSeat({ source: "order", orderRef: "a", orders: [], accepted: [], rule: MONTH, now: NOW, ...input });

  it("closes a seat whose anchoring order now reads refunded", () => {
    expect(seat({ orders: [order("a", "refunded")] })).toEqual({ kind: "close" });
  });

  it("rewinds a refunded renewal to the payment that remains, without stacking it twice", () => {
    const first = order("first", "paid", "2026-08-20T10:00:00Z");
    const renewal = order("a", "refunded", "2026-08-25T10:00:00Z");
    const result = seat({ orders: [first, renewal], accepted: [first] });
    expect(result?.kind).toBe("rewind");
    if (result?.kind !== "rewind") return;
    expect(result.plan.orderRef).toBe("first");
    expect(result.plan.expiresAt).toBe(new Date(Date.parse(first.createdAt) + 30 * DAY_MS).toISOString());
  });

  it("does not let the plain planner read the older payment as new", () => {
    // The bug the rewind exists for: with the refunded anchor out of sight, the
    // older payment is "fresh" and its term lands on the window a second time.
    const first = order("first", "paid", "2026-08-20T10:00:00Z");
    const stacked = new Date(Date.parse(first.createdAt) + 60 * DAY_MS).toISOString();
    const plain = planAccess({
      ...BASE,
      orders: [first],
      existing: { orderRef: "a", expiresAt: stacked, status: "active", revokedAt: null },
    });
    expect(plain.grant).toBe(true);
    if (plain.grant)
      expect(plain.expiresAt).not.toBe(new Date(Date.parse(first.createdAt) + 30 * DAY_MS).toISOString());
  });

  it("closes when the payments that remain predate an operator's revoke", () => {
    const first = order("first", "paid", "2026-08-20T10:00:00Z");
    expect(
      seat({
        orders: [first, order("a", "refunded", "2026-08-25T10:00:00Z")],
        accepted: [first],
        status: "revoked",
        revokedAt: "2026-08-22T00:00:00Z",
      }),
    ).toEqual({ kind: "close" });
  });

  it("leaves alone a seat whose order is still paid", () => {
    const paid = order("a", "paid");
    expect(seat({ orders: [paid], accepted: [paid] })).toBeNull();
  });

  it("treats an access-link seat and a row with no source as purchases", () => {
    expect(seat({ source: "token", orders: [order("a", "refunded")] })).toEqual({ kind: "close" });
    expect(seat({ source: null, orders: [order("a", "refunded")] })).toEqual({ kind: "close" });
  });

  it("never closes a seat no payment opened", () => {
    for (const source of ["manual", "bonus", "free", "promotion"]) {
      expect(seat({ source, orders: [order("a", "refunded")] })).toBeNull();
    }
  });

  it("leaves alone a seat whose anchor it cannot see", () => {
    expect(seat({ orderRef: "elsewhere" })).toBeNull();
    expect(seat({ orderRef: null, orders: [order("a", "refunded")] })).toBeNull();
  });
});
