import { describe, expect, it } from "vitest";

import { foldCourseAudience, type AudienceEnrollmentRow } from "./authorAudience";

/**
 * The audience count, tested where it can lie.
 *
 * Every case here is a number an author would act on: a lapsed cohort that
 * still looks full, a busy reader counted as a crowd, a blocked account that
 * quietly stays in the total.
 */
const now = new Date("2026-09-09T12:00:00Z");

function row(over: Partial<AudienceEnrollmentRow> & { id: string }): AudienceEnrollmentRow {
  return {
    courseId: "c1",
    startedAt: "2026-09-01T00:00:00Z",
    expiresAt: null,
    status: "active",
    blockedAt: null,
    ...over,
  };
}

describe("foldCourseAudience", () => {
  it("names every requested course, including one nobody has entered", () => {
    const audience = foldCourseAudience({
      courseIds: ["c1", "c2"],
      enrollments: [row({ id: "e1" })],
      activeEnrollmentIds: new Set(),
      now,
    });
    expect(audience.get("c1")?.learners).toBe(1);
    expect(audience.get("c2")).toEqual({ learners: 0, lapsed: 0, joinedRecently: 0, activeRecently: 0 });
  });

  /* The whole reason the seat state is not «expires_at in the future»: a
     revoked or blocked account would otherwise keep padding the headline. */
  it("counts expired, revoked and blocked seats as lapsed, not as learners", () => {
    const audience = foldCourseAudience({
      courseIds: ["c1"],
      enrollments: [
        row({ id: "open" }),
        row({ id: "expired", expiresAt: "2026-09-01T00:00:00Z" }),
        row({ id: "revoked", status: "revoked" }),
        row({ id: "blocked", blockedAt: "2026-09-05T00:00:00Z" }),
      ],
      activeEnrollmentIds: new Set(),
      now,
    });
    expect(audience.get("c1")).toMatchObject({ learners: 1, lapsed: 3 });
  });

  /* «7 активних із 42» must never read the other way round. A lapsed learner's
     last session is real history and still not a current reader. */
  it("never reports more active learners than open seats", () => {
    const audience = foldCourseAudience({
      courseIds: ["c1"],
      enrollments: [row({ id: "open" }), row({ id: "expired", expiresAt: "2026-08-01T00:00:00Z" })],
      activeEnrollmentIds: new Set(["open", "expired"]),
      now,
    });
    const entry = audience.get("c1");
    expect(entry?.activeRecently).toBe(1);
    expect(entry?.activeRecently).toBeLessThanOrEqual(entry?.learners ?? 0);
  });

  it("counts arrivals inside the 30-day window and not before it", () => {
    const audience = foldCourseAudience({
      courseIds: ["c1"],
      enrollments: [
        row({ id: "new", startedAt: "2026-09-08T00:00:00Z" }),
        row({ id: "old", startedAt: "2026-06-01T00:00:00Z" }),
        // A row written before `started_at` was populated is not "today".
        row({ id: "undated", startedAt: null }),
      ],
      activeEnrollmentIds: new Set(),
      now,
    });
    expect(audience.get("c1")).toMatchObject({ learners: 3, joinedRecently: 1 });
  });

  it("ignores a row for a course the caller did not ask about", () => {
    const audience = foldCourseAudience({
      courseIds: ["c1"],
      enrollments: [row({ id: "e1" }), row({ id: "other", courseId: "someone-else" })],
      activeEnrollmentIds: new Set(),
      now,
    });
    expect(audience.get("c1")?.learners).toBe(1);
    expect(audience.has("someone-else")).toBe(false);
  });
});
