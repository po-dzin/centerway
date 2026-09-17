import { describe, expect, it } from "vitest";

import {
  blockerLine,
  dayReadout,
  formatShare,
  journalWhen,
  overviewStateKeys,
  summarizeAudience,
  visibilityShort,
  waitingFor,
} from "./builderOverview";

/**
 * The overview's three sentences, tested where they can be wrong.
 *
 * Every one of them answers a question an author would otherwise have to ask a
 * person: how long has this been sitting there, can strangers see it, what is
 * stopping it. A sentence that is merely plausible here is worse than none.
 */
describe("waitingFor", () => {
  const now = Date.parse("2026-09-07T12:00:00Z");

  it("says so when the submission date was never recorded", () => {
    expect(waitingFor(null, now)).toBe("дата надсилання не збережена");
    expect(waitingFor("not a date", now)).toBe("дата надсилання не збережена");
  });

  it("does not round a few hours up into a day", () => {
    expect(waitingFor("2026-09-07T01:00:00Z", now)).toBe("надіслано сьогодні");
  });

  /* A clock skew between the browser and the server can put the timestamp in
     the future; «чекає -1 день» would be the screen reporting a bug as news. */
  it("survives a timestamp in the future", () => {
    expect(waitingFor("2026-09-09T00:00:00Z", now)).toBe("надіслано сьогодні");
  });

  it("counts whole days in Ukrainian plurals", () => {
    expect(waitingFor("2026-09-06T11:00:00Z", now)).toBe("чекає 1 день");
    expect(waitingFor("2026-09-04T11:00:00Z", now)).toBe("чекає 3 дні");
    expect(waitingFor("2026-09-01T11:00:00Z", now)).toBe("чекає 6 днів");
  });

  /* The teens are the trap: 12 takes «днів» while 22 takes «дні», and a rule
     written as `days < 5` gets both wrong. */
  it("keeps the teens and the twenties apart", () => {
    expect(waitingFor("2026-08-26T11:00:00Z", now)).toBe("чекає 12 днів");
    expect(waitingFor("2026-08-16T11:00:00Z", now)).toBe("чекає 22 дні");
  });
});

describe("visibilityShort", () => {
  it("does not let a published course imply a visible one", () => {
    expect(visibilityShort("listed")).toBe("У каталозі");
    expect(visibilityShort("unlisted")).toBe("За посиланням");
    expect(visibilityShort("hidden")).toBe("Приховано");
  });
});

describe("blockerLine", () => {
  it("reports an unreadable course as a different problem, not as -1 blockers", () => {
    expect(blockerLine(-1)).toContain("не проходить перевірку");
    expect(blockerLine(-1)).not.toContain("-1");
  });

  it("counts blockers in Ukrainian plurals", () => {
    expect(blockerLine(1)).toBe("1 блокер публікації.");
    expect(blockerLine(3)).toBe("3 блокери публікації.");
    expect(blockerLine(7)).toBe("7 блокерів публікації.");
    expect(blockerLine(12)).toBe("12 блокерів публікації.");
  });
});

describe("summarizeAudience", () => {
  const base = {
    learners: 0,
    lapsed: 0,
    joinedRecently: 0,
    activeRecently: 0,
    notStarted: 0,
    finished: 0,
    completionsRecently: 0,
    progressShare: null,
  };

  it("has no progress when no course has anything to measure", () => {
    expect(summarizeAudience([base, { ...base, learners: 3 }]).progressShare).toBeNull();
  });

  /* A course of one reader at 100% must not pull forty readers at 10% up to 55%. */
  it("weights progress by learners", () => {
    const totals = summarizeAudience([
      { ...base, learners: 1, progressShare: 1 },
      { ...base, learners: 9, progressShare: 0 },
    ]);
    expect(totals.learners).toBe(10);
    expect(totals.progressShare).toBeCloseTo(0.1);
  });
});

describe("formatShare / dayReadout", () => {
  it("prints a dash, not 0 %, where nothing was measured", () => {
    expect(formatShare(null)).toBe("—");
    expect(formatShare(0.43)).toMatch(/^43\s?%$/);
  });

  it("says a quiet day in words rather than as «0 учнів»", () => {
    expect(dayReadout({ date: "2026-09-12", learners: 0 })).toContain("ніхто не відкривав");
    expect(dayReadout({ date: "2026-09-12", learners: 3 })).toMatch(/^12 .* · 3 учні$/);
  });
});

describe("journalWhen", () => {
  const now = Date.parse("2026-09-13T12:00:00Z");

  it("names today and yesterday in Kyiv time", () => {
    expect(journalWhen("2026-09-13T16:52:00Z", now)).toBe("сьогодні, 19:52");
    // 22:30 UTC on the 11th is 01:30 on the 12th in Kyiv — yesterday, not two days ago.
    expect(journalWhen("2026-09-11T22:30:00Z", now)).toBe("учора, 01:30");
  });

  it("drops the year inside the current one and keeps it otherwise", () => {
    expect(journalWhen("2026-09-01T09:00:00Z", now)).not.toMatch(/2026/);
    expect(journalWhen("2025-12-01T09:00:00Z", now)).toMatch(/2025/);
  });

  it("prints nothing for an unreadable timestamp", () => {
    expect(journalWhen("not a date", now)).toBe("");
  });
});

describe("overviewStateKeys", () => {
  /* The overview must name a course exactly as the catalogue does, so these are
     the catalogue's cases read through the overview's summary shape. */
  it("names a draft in review as review, not with a word of its own", () => {
    expect(
      overviewStateKeys({
        status: "draft",
        hasPendingRevision: false,
        liveReviewStatus: "in_review",
        pendingReviewStatus: null,
      }),
    ).toEqual(["review"]);
  });

  it("names a returned draft as returned", () => {
    expect(
      overviewStateKeys({
        status: "draft",
        hasPendingRevision: false,
        liveReviewStatus: "changes_requested",
        pendingReviewStatus: null,
      }),
    ).toEqual(["returned"]);
  });

  /* The case the first draft got wrong twice: a live course with its next
     version in review is published AND updating AND in review — and the
     «new version saved» sentence it printed is exactly the «update» badge. */
  it("keeps a live course published while its next version is reviewed", () => {
    expect(
      overviewStateKeys({
        status: "published",
        hasPendingRevision: true,
        liveReviewStatus: "approved",
        pendingReviewStatus: "in_review",
      }),
    ).toEqual(["published", "update", "review"]);
  });
});
