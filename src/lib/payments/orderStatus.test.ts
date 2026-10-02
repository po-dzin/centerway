import { describe, expect, it } from "vitest";

import { settlementMismatch } from "./orderStatus";

describe("settlementMismatch", () => {
  it("accepts the sum and currency the order was opened for", () => {
    expect(settlementMismatch({ amount: 4100, currency: "UAH" }, { amount: 4100, currency: "uah" })).toBeNull();
  });

  it("names a different sum", () => {
    expect(settlementMismatch({ amount: 4100, currency: "UAH" }, { amount: 1, currency: "UAH" })).toBe("amount");
  });

  it("names a different currency before the sum", () => {
    expect(settlementMismatch({ amount: 4100, currency: "UAH" }, { amount: 4100, currency: "USD" })).toBe("currency");
  });

  /* An old order row without the column is our gap, not the buyer's: refusing
     would lock out someone who paid. */
  it("does not refuse over a side the order does not record", () => {
    expect(settlementMismatch({ amount: null, currency: null }, { amount: 4100, currency: "UAH" })).toBeNull();
    expect(settlementMismatch({ amount: 4100, currency: "UAH" }, { amount: null, currency: null })).toBeNull();
  });
});
