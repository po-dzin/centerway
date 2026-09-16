import { describe, expect, it } from "vitest";

import {
  audienceLine,
  audienceNote,
  blockerLine,
  overviewStateKeys,
  visibilityLine,
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

describe("visibilityLine", () => {
  it("does not let a published course imply a visible one", () => {
    expect(visibilityLine("listed")).toContain("У каталозі");
    expect(visibilityLine("unlisted")).toContain("прямим посиланням");
    expect(visibilityLine("hidden")).toContain("Приховано");
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

describe("audienceLine / audienceNote", () => {
  const base = { learners: 0, lapsed: 0, joinedRecently: 0, activeRecently: 0 };

  it("says an empty course is empty rather than reporting activity in it", () => {
    expect(audienceLine({ ...base, lapsed: 4 })).toBe("0 учнів з відкритим доступом.");
  });

  it("puts the total and the active week in one sentence", () => {
    expect(audienceLine({ ...base, learners: 42, activeRecently: 7 })).toBe("42 учні · 7 активних за тиждень.");
    expect(audienceLine({ ...base, learners: 1, activeRecently: 1 })).toBe("1 учень · 1 активний за тиждень.");
    expect(audienceLine({ ...base, learners: 5, activeRecently: 0 })).toBe("5 учнів · 0 активних за тиждень.");
  });

  it("adds nothing when there is nothing to add", () => {
    expect(audienceNote({ ...base, learners: 3 })).toBeNull();
  });

  it("names new arrivals and closed access together", () => {
    expect(audienceNote({ ...base, learners: 3, joinedRecently: 2, lapsed: 1 })).toBe(
      "+2 нові за 30 днів · 1 доступ закінчився",
    );
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
