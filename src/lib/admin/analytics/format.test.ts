import { describe, expect, it, vi, afterEach } from "vitest";

import {
  buildMonthGrid,
  buildNiceScale,
  buildPresetRange,
  clampIsoToToday,
  detectActivePreset,
  formatCompactTick,
  formatDateLocal,
  formatProductName,
  freshnessStatus,
  funnelSourceLabel,
  isIsoDateInput,
  isoToDate,
  normalizeDateRange,
  shiftedDate,
  toNumberInput,
} from "@/lib/admin/analytics/format";

/* These ran for months with no test at all, because they lived inside a
   2583-line client component behind a Google sign-in: unreachable from a test
   and unverifiable by opening the page. Each one can be wrong in a way a
   screenshot would not show. */

afterEach(() => {
  vi.useRealTimers();
});

/** Local midnight, so the assertions do not depend on the runner's zone. */
function atLocal(y: number, m: number, d: number, h = 12) {
  return new Date(y, m - 1, d, h);
}

describe("the axis", () => {
  /* The one that actually matters: a scale whose top is BELOW the tallest bar
     draws that bar out of the chart. */
  it("never rounds the maximum below the value it has to hold", () => {
    for (const max of [1, 3, 7, 42, 99, 100, 101, 1234, 98765, 1_000_001]) {
      const { scaleMax } = buildNiceScale(max);
      expect(scaleMax).toBeGreaterThanOrEqual(max);
    }
  });

  it("returns a usable scale for the empty chart rather than dividing by zero", () => {
    expect(buildNiceScale(0)).toEqual({ scaleMax: 1, ticks: [0, 0.25, 0.5, 0.75, 1] });
    expect(buildNiceScale(Number.NaN).scaleMax).toBe(1);
    expect(buildNiceScale(-5).scaleMax).toBe(1);
  });

  it("spaces its ticks evenly from zero", () => {
    const { ticks } = buildNiceScale(1000);
    expect(ticks).toHaveLength(5);
    expect(ticks[0]).toBe(0);
    const step = ticks[1]! - ticks[0]!;
    for (let i = 1; i < ticks.length; i += 1) {
      expect(ticks[i]! - ticks[i - 1]!).toBeCloseTo(step, 9);
    }
  });

  it("prints a tick compactly, and zero as zero", () => {
    expect(formatCompactTick(0, "en")).toBe("0");
    expect(formatCompactTick(-10, "en")).toBe("0");
    expect(formatCompactTick(950, "en")).toBe("950");
    expect(formatCompactTick(1500, "en")).toBe("1.5K");
  });
});

describe("the calendar grid", () => {
  it("always starts on a Monday and always holds six weeks", () => {
    for (const month of [atLocal(2026, 1, 15), atLocal(2026, 2, 1), atLocal(2026, 8, 31), atLocal(2024, 2, 10)]) {
      const grid = buildMonthGrid(month);
      expect(grid).toHaveLength(42);
      expect(grid[0]!.getDay()).toBe(1);
    }
  });

  /* A month that BEGINS on a Monday is the case a "back up to the previous
     Sunday" implementation gets wrong, by backing up a whole week. */
  it("does not prepend a dead week to a month that begins on a Monday", () => {
    const june2025 = atLocal(2025, 9, 10); // September 2025 starts on a Monday
    const grid = buildMonthGrid(june2025);
    expect(formatDateLocal(grid[0]!)).toBe("2025-09-01");
  });

  it("covers every day of the month it was asked for", () => {
    const grid = buildMonthGrid(atLocal(2026, 5, 4)).map(formatDateLocal);
    expect(grid).toContain("2026-05-01");
    expect(grid).toContain("2026-05-31");
  });
});

describe("dates in and out", () => {
  it("formats from local parts, not from UTC", () => {
    // 23:30 local on the 5th is the 6th in UTC east of Greenwich; the picker
    // must still say the 5th, because that is the day the reader is looking at.
    expect(formatDateLocal(atLocal(2026, 3, 5, 23))).toBe("2026-03-05");
  });

  it("accepts only a complete ISO day", () => {
    expect(isIsoDateInput("2026-03-05")).toBe(true);
    expect(isIsoDateInput("2026-3-5")).toBe(false);
    expect(isIsoDateInput("2026-03")).toBe(false);
    expect(isIsoDateInput("")).toBe(false);
  });

  it("refuses a date that does not exist, rather than rolling it forward", () => {
    expect(isoToDate("2026-02-30")).toBeNull();
    expect(isoToDate("2026-13-01")).toBeNull();
    expect(isoToDate("nonsense")).toBeNull();
    expect(isoToDate("2024-02-29")).not.toBeNull(); // a real leap day
  });

  it("clamps the future to today and leaves the past alone", () => {
    vi.useFakeTimers();
    vi.setSystemTime(atLocal(2026, 9, 11));
    expect(clampIsoToToday("2027-01-01")).toBe("2026-09-11");
    expect(clampIsoToToday("2026-09-11")).toBe("2026-09-11");
    expect(clampIsoToToday("2020-01-01")).toBe("2020-01-01");
  });

  it("puts a backwards range the right way round", () => {
    vi.useFakeTimers();
    vi.setSystemTime(atLocal(2026, 9, 11));
    expect(normalizeDateRange({ from: "2026-09-10", to: "2026-09-01" })).toEqual({
      from: "2026-09-01",
      to: "2026-09-10",
    });
  });

  it("counts back inclusively — a week is seven days, not eight", () => {
    vi.useFakeTimers();
    vi.setSystemTime(atLocal(2026, 9, 11));
    expect(shiftedDate(0)).toBe("2026-09-11");
    expect(buildPresetRange("7d")).toEqual({ from: "2026-09-05", to: "2026-09-11" });
    expect(buildPresetRange("30d").from).toBe("2026-08-13");
    expect(buildPresetRange("mtd")).toEqual({ from: "2026-09-01", to: "2026-09-11" });
  });

  it("recognises its own presets, and nothing else", () => {
    vi.useFakeTimers();
    vi.setSystemTime(atLocal(2026, 9, 11));
    for (const preset of ["7d", "30d", "mtd", "90d", "1y"] as const) {
      expect(detectActivePreset(buildPresetRange(preset))).toBe(preset);
    }
    expect(detectActivePreset({ from: "2026-01-02", to: "2026-03-04" })).toBeNull();
  });
});

describe("the small judgements", () => {
  it("reads a number field as a non-negative number, or as zero", () => {
    expect(toNumberInput("1200")).toBe(1200);
    expect(toNumberInput("-5")).toBe(0);
    expect(toNumberInput("")).toBe(0);
    expect(toNumberInput("abc")).toBe(0);
  });

  it("prefers the course's own title, and only then the code", () => {
    expect(formatProductName({ product_code: "way21", product_title: "Шлях 21" }, "—")).toBe("Шлях 21");
    expect(formatProductName({ product_code: "way21" }, "—")).toBe("way21");
    expect(formatProductName({ product_code: "unknown" }, "—")).toBe("—");
    expect(formatProductName({ product_code: "  " }, "—")).toBe("—");
  });

  it("calls data stale only after the window it was given", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-11T12:00:00Z"));
    expect(freshnessStatus(null, 24)).toBe("empty");
    expect(freshnessStatus("not a timestamp", 24)).toBe("empty");
    expect(freshnessStatus("2026-09-11T11:00:00Z", 24)).toBe("ok");
    expect(freshnessStatus("2026-09-09T11:00:00Z", 24)).toBe("warn");
  });

  /* The branch that outlived its dictionary key once already — see the comment
     on the fallback. Every source has to resolve to a key, or the admin prints
     the key itself. */
  it("has a dictionary key for every source it can be handed", () => {
    const sources = [
      "local_events",
      "local_events_floored",
      "pixel_daily_stats",
      "pixel_stats_reference",
      "pixel_fallback",
      "capi_fallback",
      "meta_daily",
      "manual_input",
      "orders_created",
      "paid_orders",
      "access_delivered",
    ] as const;
    const seen = new Set<string>();
    for (const source of sources) {
      const key = funnelSourceLabel((k) => String(k), source);
      expect(key).toMatch(/^analytics_source_/);
      seen.add(key);
    }
    expect(seen.size).toBe(sources.length);
  });
});
