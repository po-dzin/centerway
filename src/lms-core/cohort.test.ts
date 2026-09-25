import { describe, expect, it } from "vitest";

import { dripAnchor, summarizeStanding } from "./schedule";
import { enrollmentDayNumber, instantOnCalendarDate, localCalendarDate, parseCalendarDate } from "./time";
import type { Course } from "./course";

const ZONES = ["Europe/Kyiv", "America/Vancouver", "Pacific/Tongatapu", "Etc/GMT+12", "Pacific/Kiritimati", "UTC"];

describe("a cohort starts on a date, in each learner's own timezone", () => {
  it("lands on the named calendar date in every zone, including the ones where noon UTC is another day", () => {
    const date = { year: 2026, month: 10, day: 6 };
    for (const zone of ZONES) {
      expect(localCalendarDate(instantOnCalendarDate(date, zone), zone), zone).toEqual(date);
    }
  });

  it("refuses dates that do not exist", () => {
    expect(parseCalendarDate("2026-02-30")).toBeNull();
    expect(parseCalendarDate("6 жовтня")).toBeNull();
    expect(parseCalendarDate(null)).toBeNull();
    expect(parseCalendarDate("2026-10-06")).toEqual({ year: 2026, month: 10, day: 6 });
  });
});

describe("dripAnchor", () => {
  const opened = new Date("2026-10-01T09:00:00Z");

  it("keeps the self-paced rhythm when there is no cohort", () => {
    expect(dripAnchor({ startedAt: opened, cohortStartsOn: null }, "Europe/Kyiv")).toBe(opened);
    expect(dripAnchor({ startedAt: opened }, "Europe/Kyiv")).toBe(opened);
  });

  it("puts the early sign-up and the late joiner on the same day", () => {
    const now = new Date("2026-10-08T10:00:00Z");
    const early = dripAnchor(
      { startedAt: new Date("2026-09-28T08:00:00Z"), cohortStartsOn: "2026-10-06" },
      "Europe/Kyiv",
    );
    const late = dripAnchor(
      { startedAt: new Date("2026-10-08T07:00:00Z"), cohortStartsOn: "2026-10-06" },
      "Europe/Kyiv",
    );
    expect(enrollmentDayNumber(early, now, "Europe/Kyiv")).toBe(3);
    expect(enrollmentDayNumber(late, now, "Europe/Kyiv")).toBe(3);
  });

  it("falls back to the opened day for a date it cannot read, rather than a wrong day", () => {
    expect(dripAnchor({ startedAt: opened, cohortStartsOn: "soon" }, "Europe/Kyiv")).toBe(opened);
  });
});

describe("standing before a cohort's day 1", () => {
  const course = { schedule: { mode: "daily" }, modules: [] } as unknown as Course;
  const progress = { completedLessonIds: [] } as never;

  it("says when it starts instead of a negative day", () => {
    const startedAt = dripAnchor({ startedAt: new Date(), cohortStartsOn: "2026-10-06" }, "Europe/Kyiv");
    const before = summarizeStanding(course, progress, {
      startedAt,
      timeZone: "Europe/Kyiv",
      now: new Date("2026-10-03T10:00:00Z"),
    });
    expect(before).toMatchObject({ currentDay: null, startsInDays: 3 });

    const dayOne = summarizeStanding(course, progress, {
      startedAt,
      timeZone: "Europe/Kyiv",
      now: new Date("2026-10-06T05:00:00Z"),
    });
    expect(dayOne).toMatchObject({ currentDay: 1, startsInDays: null });
  });
});
