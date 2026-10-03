import { describe, expect, it } from "vitest";

import type { ProgramFormat } from "./formats";
import { countdownText, daysUntil, featuredFormat } from "./formatFeatured";

function format(code: string, kind: ProgramFormat["format"], cohortStartsOn: string | null = null): ProgramFormat {
  return {
    code,
    format: kind,
    label: kind,
    summary: null,
    features: [],
    mode: "checkout",
    amount: 4100,
    listAmount: null,
    currency: "UAH",
    cohortStartsOn,
    includes: [],
  };
}

const now = new Date("2026-10-03T21:30:00Z");

describe("featured format", () => {
  it("counts whole days to a start and drops a past one", () => {
    expect(daysUntil("2026-11-01", now)).toBe(29);
    expect(daysUntil("2026-10-03", now)).toBe(0);
    expect(daysUntil("2026-10-01", now)).toBeNull();
    expect(daysUntil(null, now)).toBeNull();
  });

  it("gives the gold to the nearest cohort ahead, else to the self-paced format", () => {
    const self = format("course:way21", "self");
    const ind = format("way21-support", "individual");
    expect(featuredFormat([self], now)).toBeNull();
    expect(featuredFormat([ind, self], now)).toBe("course:way21");
    expect(
      featuredFormat([self, format("g-feb", "group", "2027-02-01"), format("g-nov", "group", "2026-11-01"), ind], now),
    ).toBe("g-nov");
    expect(featuredFormat([self, format("g-old", "group", "2026-10-01")], now)).toBe("course:way21");
  });

  it("says the days in Ukrainian", () => {
    expect([0, 1, 2, 5, 11, 21, 22, 29].map(countdownText)).toEqual([
      "сьогодні",
      "через 1 день",
      "через 2 дні",
      "через 5 днів",
      "через 11 днів",
      "через 21 день",
      "через 22 дні",
      "через 29 днів",
    ]);
  });
});
