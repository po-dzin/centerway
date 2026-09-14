import { describe, expect, it } from "vitest";

import { COURSE_STATE_LABELS, COURSE_STATE_TONES, courseStateKeys, courseStateLabel } from "./courseState";

describe("courseStateKeys", () => {
  it("names a live approved course once", () => {
    expect(courseStateKeys({ status: "published", reviewStatus: "approved", hasPendingRevision: false })).toEqual([
      "published",
    ]);
  });

  it("treats a course published before review existed as published", () => {
    expect(courseStateKeys({ status: "published", reviewStatus: null, hasPendingRevision: false })).toEqual([
      "published",
    ]);
  });

  it("says a live course that skipped review is unreviewed", () => {
    expect(courseStateKeys({ status: "published", reviewStatus: "draft", hasPendingRevision: false })).toEqual([
      "unreviewed",
    ]);
  });

  it("walks a draft through review and back", () => {
    expect(courseStateKeys({ status: "draft", reviewStatus: "draft", hasPendingRevision: false })).toEqual(["draft"]);
    expect(courseStateKeys({ status: "draft", reviewStatus: "in_review", hasPendingRevision: false })).toEqual([
      "review",
    ]);
    expect(courseStateKeys({ status: "draft", reviewStatus: "changes_requested", hasPendingRevision: false })).toEqual([
      "returned",
    ]);
  });

  it("adds the update and where it stands, without repeating a word", () => {
    expect(
      courseStateKeys({
        status: "published",
        reviewStatus: "approved",
        hasPendingRevision: true,
        pendingReviewStatus: "in_review",
      }),
    ).toEqual(["published", "update", "review"]);
    expect(
      courseStateKeys({
        status: "published",
        reviewStatus: "in_review",
        hasPendingRevision: true,
        pendingReviewStatus: "in_review",
      }),
    ).toEqual(["review", "update"]);
  });
});

describe("labels", () => {
  it("is one word in Ukrainian for every lifecycle state", () => {
    for (const label of Object.values(COURSE_STATE_LABELS)) {
      expect(label.uk.trim().split(/\s+/)).toHaveLength(1);
    }
  });

  it("gives every state a tone, and colour only to what asks something of the reader", () => {
    expect(Object.keys(COURSE_STATE_TONES).sort()).toEqual(Object.keys(COURSE_STATE_LABELS).sort());
    expect(COURSE_STATE_TONES.draft).toBe("neutral");
    expect(COURSE_STATE_TONES.published).toBe("neutral");
    expect(COURSE_STATE_TONES.on_sale).toBe("success");
  });

  it("falls back to Ukrainian for any language but English", () => {
    expect(courseStateLabel("draft", "en")).toBe("Draft");
    expect(courseStateLabel("draft", "uk")).toBe("Чернетка");
    expect(courseStateLabel("draft", "ru")).toBe("Чернетка");
  });
});
