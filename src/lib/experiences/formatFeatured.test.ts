import { describe, expect, it } from "vitest";

import type { ProgramFormat } from "./formats";
import { countdownText, daysUntil, featuredFormat, isPrimaryFormat, nearestCohort } from "./formatFeatured";

function format(
  code: string,
  kind: ProgramFormat["format"],
  cohortStartsOn: string | null = null,
  featured = false,
): ProgramFormat {
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
    featured,
    early: null,
    earlyAmount: null,
    earlyUntil: null,
    regularAmount: null,
    regularListAmount: null,
    includes: [],
  };
}

const now = new Date("2026-10-03T09:00:00Z");

describe("featured format", () => {
  it("counts whole days to a start and drops a past one", () => {
    expect(daysUntil("2026-11-01", now)).toBe(29);
    expect(daysUntil("2026-10-03", now)).toBe(0);
    expect(daysUntil("2026-10-01", now)).toBeNull();
    expect(daysUntil(null, now)).toBeNull();
  });

  it("counts on the Kyiv calendar, where a cohort's day begins", () => {
    // 22:30 UTC on 31.10 is already 1 November in Kyiv: the stream starts today.
    const kyivMidnight = new Date("2026-10-31T22:30:00Z");
    expect(daysUntil("2026-11-01", kyivMidnight)).toBe(0);
    expect(daysUntil("2026-11-02", kyivMidnight)).toBe(1);
    expect(daysUntil("2026-10-31", kyivMidnight)).toBeNull();
  });

  it("gives the gold only to the format the owner marked", () => {
    const self = format("course:way21", "self");
    const group = format("g", "group", "2026-11-01");
    const ind = format("way21-support", "individual", null, true);
    expect(featuredFormat([self, group])).toBeNull();
    expect(featuredFormat([self, group, ind])).toBe("way21-support");
    // Unmarked: every button in the row is secondary…
    expect(isPrimaryFormat([self, group], "g")).toBe(false);
    expect(isPrimaryFormat([self, group], "course:way21")).toBe(false);
    // …except a program's only format, which has nothing to be compared with.
    expect(isPrimaryFormat([self], "course:way21")).toBe(true);
    expect(isPrimaryFormat([self, group, ind], "way21-support")).toBe(true);
    expect(isPrimaryFormat([self, group, ind], "g")).toBe(false);
  });

  it("finds the nearest cohort ahead, as information", () => {
    const self = format("course:way21", "self");
    expect(
      nearestCohort([self, format("g-feb", "group", "2027-02-01"), format("g-nov", "group", "2026-11-01")], now),
    ).toBe("g-nov");
    expect(nearestCohort([self, format("g-old", "group", "2026-10-01")], now)).toBeNull();
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
