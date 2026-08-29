import { describe, expect, it } from "vitest";

import { planAccess, type AccessPlanInput } from "./access";

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
