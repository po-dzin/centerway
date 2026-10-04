import { describe, expect, it } from "vitest";

import { currentPrice, kyivMidnight } from "./earlyPrice";

const row = { amount: 4100, listAmount: null, earlyAmount: 3400, earlyUntil: "2026-10-15" };

describe("early price", () => {
  it("starts the date at 00:00 Kyiv, in summer and in winter time", () => {
    expect(kyivMidnight("2026-10-15")?.toISOString()).toBe("2026-10-14T21:00:00.000Z");
    expect(kyivMidnight("2026-11-15")?.toISOString()).toBe("2026-11-14T22:00:00.000Z");
    expect(kyivMidnight("15.10.2026")).toBeNull();
  });

  it("charges the early price before the date and strikes the later one", () => {
    expect(currentPrice(row, new Date("2026-10-03T09:00:00Z"))).toEqual({
      amount: 3400,
      listAmount: 4100,
      early: { until: "2026-10-15", endsAt: "2026-10-14T21:00:00.000Z", laterAmount: 4100 },
    });
  });

  it("reads as the plain price from Kyiv midnight on", () => {
    expect(currentPrice(row, new Date("2026-10-14T21:00:00Z"))).toEqual({
      amount: 4100,
      listAmount: null,
      early: null,
    });
    expect(currentPrice(row, new Date("2026-10-14T20:59:00Z")).amount).toBe(3400);
  });

  it("ignores an early price that is missing half or is not lower", () => {
    const now = new Date("2026-10-03T09:00:00Z");
    expect(currentPrice({ ...row, earlyUntil: null }, now).early).toBeNull();
    expect(currentPrice({ ...row, earlyAmount: 4100 }, now).amount).toBe(4100);
    expect(currentPrice({ ...row, amount: null }, now).amount).toBeNull();
  });
});
