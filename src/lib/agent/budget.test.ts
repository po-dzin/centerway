import { describe, expect, it } from "vitest";

import {
  DAILY_TOKEN_LIMIT,
  DAILY_TOKEN_LIMIT_PLATFORM,
  budgetDayStart,
  budgetVerdict,
} from "./budget";

describe("agent budget", () => {
  it("allows a subject under its ceiling and reports what is left", () => {
    const verdict = budgetVerdict({ subject: "learner", spentBySubject: 50_000, spentByPlatform: 0 });
    expect(verdict).toEqual({ allowed: true, remaining: DAILY_TOKEN_LIMIT.learner - 50_000 });
  });

  it("refuses a subject at its ceiling, naming the ceiling it hit", () => {
    const verdict = budgetVerdict({
      subject: "guest",
      spentBySubject: DAILY_TOKEN_LIMIT.guest,
      spentByPlatform: 0,
    });
    expect(verdict).toEqual({
      allowed: false,
      reason: "subject_daily",
      spent: DAILY_TOKEN_LIMIT.guest,
      limit: DAILY_TOKEN_LIMIT.guest,
    });
  });

  /**
   * The order matters. An author has ten times a learner's budget, and on the
   * day something runs away that is exactly the account most able to keep
   * spending — so the project ceiling is checked before the personal one.
   */
  it("refuses on the platform ceiling even when the subject has budget left", () => {
    const verdict = budgetVerdict({
      subject: "author",
      spentBySubject: 0,
      spentByPlatform: DAILY_TOKEN_LIMIT_PLATFORM,
    });
    expect(verdict.allowed).toBe(false);
    if (verdict.allowed) return;
    expect(verdict.reason).toBe("platform_daily");
  });

  it("gives a guest a far smaller allowance than a paying learner", () => {
    // Not a preference — the guest surface is public, so its ceiling is what
    // stands between a crawler and an invoice.
    expect(DAILY_TOKEN_LIMIT.guest).toBeLessThan(DAILY_TOKEN_LIMIT.learner);
    expect(DAILY_TOKEN_LIMIT.learner).toBeLessThan(DAILY_TOKEN_LIMIT.author);
  });

  it("resets the day in Kyiv, not in UTC", () => {
    // 00:30 Kyiv on 29 August is still 21:30 UTC on the 28th in summer time.
    // A UTC reset would hand that person yesterday's exhausted budget.
    const justAfterKyivMidnight = new Date("2026-08-28T21:30:00.000Z");
    const start = new Date(budgetDayStart(justAfterKyivMidnight));
    expect(justAfterKyivMidnight.getTime() - start.getTime()).toBeLessThan(3 * 60 * 60 * 1000);
    expect(start.getTime()).toBeLessThanOrEqual(justAfterKyivMidnight.getTime());
  });
});
