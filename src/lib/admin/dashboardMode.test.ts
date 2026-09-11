import { describe, expect, it } from "vitest";
import {
  ANALYTICS_SECTIONS,
  DASHBOARD_MODES,
  DEFAULT_DASHBOARD_MODE,
  MODE_SECTIONS,
  isDashboardMode,
  sectionForMode,
  type AnalyticsSection,
} from "./dashboardMode";

describe("the two modes between them", () => {
  it("offer every section, so nothing becomes unreachable", () => {
    // The point of the split is to stop making one question read past the
    // other's answer — not to quietly retire a tab. If a section appears in
    // neither list it has been deleted by accident.
    const offered = new Set(Object.values(MODE_SECTIONS).flat());
    for (const section of ANALYTICS_SECTIONS) {
      expect(offered.has(section)).toBe(true);
    }
  });

  it("offer nothing that is not a real section", () => {
    for (const mode of DASHBOARD_MODES) {
      for (const section of MODE_SECTIONS[mode]) {
        expect(ANALYTICS_SECTIONS).toContain(section);
      }
    }
  });

  it("both start at the overview, which is the only section they share", () => {
    expect(MODE_SECTIONS.courses[0]).toBe("overview");
    expect(MODE_SECTIONS.traffic[0]).toBe("overview");
    const shared = MODE_SECTIONS.courses.filter((s) => MODE_SECTIONS.traffic.includes(s));
    expect(shared).toEqual(["overview"]);
  });

  it("put the Meta attribution machinery on the traffic side", () => {
    for (const section of ["campaigns", "capi", "inputs_quality", "funnel"] as AnalyticsSection[]) {
      expect(MODE_SECTIONS.traffic).toContain(section);
      expect(MODE_SECTIONS.courses).not.toContain(section);
    }
  });

  it("default to the question asked daily", () => {
    expect(DEFAULT_DASHBOARD_MODE).toBe("courses");
  });
});

describe("sectionForMode", () => {
  it("keeps you where you were when the new mode still offers it", () => {
    expect(sectionForMode("traffic", "overview")).toBe("overview");
  });

  it("falls back to the overview rather than leaving an empty page", () => {
    // The failure this prevents: switching to Courses while reading Campaigns
    // leaves `analyticsSection` on a tab the strip no longer shows, and every
    // block on the page is gated on it — a header with nothing underneath,
    // which reads as broken rather than as a mode change.
    expect(sectionForMode("courses", "campaigns")).toBe("overview");
    expect(sectionForMode("courses", "capi")).toBe("overview");
    expect(sectionForMode("courses", "inputs_quality")).toBe("overview");
    expect(sectionForMode("traffic", "products")).toBe("overview");
    expect(sectionForMode("traffic", "dosha")).toBe("overview");
  });

  it("never returns a section the chosen mode does not offer", () => {
    for (const mode of DASHBOARD_MODES) {
      for (const section of ANALYTICS_SECTIONS) {
        expect(MODE_SECTIONS[mode]).toContain(sectionForMode(mode, section));
      }
    }
  });
});

describe("isDashboardMode", () => {
  it("accepts only the two modes, whatever localStorage held", () => {
    // The stored value is read back from a browser we do not control; a stale
    // or hand-edited key must land on the default, not on a mode with no tabs.
    expect(isDashboardMode("courses")).toBe(true);
    expect(isDashboardMode("traffic")).toBe(true);
    for (const value of ["Courses", "", "ads", null, undefined, 1, ["traffic"], {}]) {
      expect(isDashboardMode(value)).toBe(false);
    }
  });
});
