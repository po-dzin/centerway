import { describe, expect, it } from "vitest";

import {
  audienceDayKeys,
  foldAuthorAudience,
  stepLessonsByCourse,
  type AudienceEnrollmentRow,
  type AudienceEventRow,
} from "./authorAudience";

/**
 * The audience count, tested where it can lie.
 *
 * Every case here is a number an author would act on: a lapsed cohort that
 * still looks full, a busy reader counted as a crowd, a blocked account that
 * quietly stays in the total, a deleted lesson that keeps a course unfinished.
 */
const now = new Date("2026-09-09T12:00:00Z");

function row(over: Partial<AudienceEnrollmentRow> & { id: string }): AudienceEnrollmentRow {
  return {
    courseId: "c1",
    userId: `u-${over.id}`,
    startedAt: "2026-09-01T00:00:00Z",
    expiresAt: null,
    status: "active",
    blockedAt: null,
    ...over,
  };
}

let clientSeq = 0;
function event(enrollmentId: string, lessonId: string, type: string, occurredAt: string): AudienceEventRow {
  clientSeq += 1;
  return { enrollmentId, lessonId, type, occurredAt, clientId: `cl-${clientSeq}` };
}

const lessons = new Map([["c1", new Set(["l1", "l2"])]]);

function fold(input: {
  enrollments: AudienceEnrollmentRow[];
  events?: AudienceEventRow[];
  courseIds?: string[];
  lessonsByCourse?: Map<string, Set<string>>;
}) {
  return foldAuthorAudience({
    courseIds: input.courseIds ?? ["c1"],
    enrollments: input.enrollments,
    events: input.events ?? [],
    lessonsByCourse: input.lessonsByCourse ?? lessons,
    now,
  });
}

describe("foldAuthorAudience — seats", () => {
  it("names every requested course, including one nobody has entered", () => {
    const { courses } = fold({ courseIds: ["c1", "c2"], enrollments: [row({ id: "e1" })] });
    expect(courses.get("c1")?.learners).toBe(1);
    expect(courses.get("c2")).toMatchObject({ learners: 0, lapsed: 0, progressShare: null });
  });

  /* The whole reason the seat state is not «expires_at in the future»: a
     revoked or blocked account would otherwise keep padding the headline. */
  it("counts expired, revoked and blocked seats as lapsed, not as learners", () => {
    const { courses } = fold({
      enrollments: [
        row({ id: "open" }),
        row({ id: "expired", expiresAt: "2026-09-01T00:00:00Z" }),
        row({ id: "revoked", status: "revoked" }),
        row({ id: "blocked", blockedAt: "2026-09-05T00:00:00Z" }),
      ],
    });
    expect(courses.get("c1")).toMatchObject({ learners: 1, lapsed: 3 });
  });

  it("counts arrivals inside the 30-day window and not before it", () => {
    const { courses } = fold({
      enrollments: [
        row({ id: "new", startedAt: "2026-09-08T00:00:00Z" }),
        row({ id: "old", startedAt: "2026-06-01T00:00:00Z" }),
        // A row written before `started_at` was populated is not "today".
        row({ id: "undated", startedAt: null }),
      ],
    });
    expect(courses.get("c1")).toMatchObject({ learners: 3, joinedRecently: 1 });
  });

  it("ignores a row for a course the caller did not ask about", () => {
    const { courses } = fold({ enrollments: [row({ id: "e1" }), row({ id: "other", courseId: "someone-else" })] });
    expect(courses.get("c1")?.learners).toBe(1);
    expect(courses.has("someone-else")).toBe(false);
  });
});

describe("foldAuthorAudience — activity and progress", () => {
  /* «7 активних із 42» must never read the other way round. */
  it("never reports more active learners than open seats", () => {
    const { courses } = fold({
      enrollments: [row({ id: "open" }), row({ id: "expired", expiresAt: "2026-08-01T00:00:00Z" })],
      events: [
        event("open", "l1", "lesson.started", "2026-09-08T10:00:00Z"),
        event("expired", "l1", "lesson.started", "2026-09-08T10:00:00Z"),
      ],
    });
    expect(courses.get("c1")).toMatchObject({ learners: 1, activeRecently: 1 });
  });

  it("counts a busy reader as one active person and each completion once", () => {
    const repeated = event("e1", "l1", "lesson.completed", "2026-09-08T10:00:00Z");
    const { courses } = fold({
      enrollments: [row({ id: "e1" })],
      events: [
        event("e1", "l1", "lesson.started", "2026-09-08T09:00:00Z"),
        repeated,
        { ...repeated },
        event("e1", "l2", "lesson.opened", "2026-09-08T11:00:00Z"),
        // Outside the week: real progress, not recent activity.
        event("e1", "l2", "lesson.completed", "2026-08-01T11:00:00Z"),
      ],
    });
    expect(courses.get("c1")).toMatchObject({ activeRecently: 1, completionsRecently: 1 });
  });

  it("tells a seat nobody opened from a seat that went quiet", () => {
    const { courses } = fold({
      enrollments: [row({ id: "never" }), row({ id: "quiet" })],
      events: [event("quiet", "l1", "lesson.started", "2026-08-01T10:00:00Z")],
    });
    expect(courses.get("c1")).toMatchObject({ learners: 2, notStarted: 1, activeRecently: 0 });
  });

  it("averages progress over open learners, with the player's own fold", () => {
    const { courses } = fold({
      enrollments: [row({ id: "done" }), row({ id: "half" }), row({ id: "undone" }), row({ id: "none" })],
      events: [
        event("done", "l1", "lesson.completed", "2026-09-01T10:00:00Z"),
        event("done", "l2", "lesson.completed", "2026-09-01T11:00:00Z"),
        event("half", "l1", "lesson.completed", "2026-09-01T10:00:00Z"),
        // Completed and then withdrawn: not done, exactly as the player says.
        event("undone", "l1", "lesson.completed", "2026-09-01T10:00:00Z"),
        event("undone", "l1", "lesson.uncompleted", "2026-09-01T11:00:00Z"),
      ],
    });
    const entry = courses.get("c1");
    expect(entry?.finished).toBe(1);
    expect(entry?.progressShare).toBeCloseTo((1 + 0.5 + 0 + 0) / 4);
  });

  it("does not count a deleted lesson towards finishing", () => {
    const { courses } = fold({
      enrollments: [row({ id: "e1" })],
      events: [
        event("e1", "l1", "lesson.completed", "2026-09-01T10:00:00Z"),
        event("e1", "gone", "lesson.completed", "2026-09-01T10:00:00Z"),
      ],
    });
    expect(courses.get("c1")).toMatchObject({ finished: 0, progressShare: 0.5 });
  });

  it("has no progress, rather than zero progress, for a course without lessons", () => {
    const { courses } = fold({ enrollments: [row({ id: "e1" })], lessonsByCourse: new Map() });
    expect(courses.get("c1")?.progressShare).toBeNull();
  });
});

describe("foldAuthorAudience — daily series", () => {
  it("is thirty Kyiv days long, ending today", () => {
    const keys = audienceDayKeys(now);
    expect(keys).toHaveLength(30);
    expect(keys[29]).toBe("2026-09-09");
    expect(keys[0]).toBe("2026-08-11");
  });

  it("buckets by Kyiv calendar day, not by UTC", () => {
    // 22:30 UTC on the 7th is already the 8th in Kyiv (UTC+3 in September).
    const { days } = fold({
      enrollments: [row({ id: "e1" })],
      events: [event("e1", "l1", "lesson.started", "2026-09-07T22:30:00Z")],
    });
    expect(days.find((day) => day.date === "2026-09-08")?.learners).toBe(1);
    expect(days.find((day) => day.date === "2026-09-07")?.learners).toBe(0);
  });

  it("counts a person once per day across courses, and keeps lapsed readers in history", () => {
    const { days } = fold({
      courseIds: ["c1", "c2"],
      enrollments: [
        row({ id: "a", userId: "same" }),
        row({ id: "b", userId: "same", courseId: "c2" }),
        row({ id: "gone", expiresAt: "2026-09-08T00:00:00Z" }),
      ],
      events: [
        event("a", "l1", "lesson.started", "2026-09-05T08:00:00Z"),
        event("b", "x1", "lesson.started", "2026-09-05T09:00:00Z"),
        event("gone", "l1", "lesson.started", "2026-09-05T10:00:00Z"),
      ],
    });
    expect(days.find((day) => day.date === "2026-09-05")?.learners).toBe(2);
  });
});

describe("stepLessonsByCourse", () => {
  /* A reference page cannot be marked done, so counting it would hold every
     learner of the course below 100% and out of «пройшли» for ever. */
  it("leaves reference-module lessons out of the steps that count", () => {
    const steps = stepLessonsByCourse(
      [
        { id: "l1", course_id: "c1", module_id: "m1" },
        { id: "l2", course_id: "c1", module_id: "m1" },
        { id: "ref", course_id: "c1", module_id: "handbook" },
        { id: "x1", course_id: "c2", module_id: "m2" },
      ],
      new Set(["handbook"]),
    );
    expect([...(steps.get("c1") ?? [])]).toEqual(["l1", "l2"]);
    expect([...(steps.get("c2") ?? [])]).toEqual(["x1"]);
  });

  it("lets a learner who did every step finish a course that also has a handbook", () => {
    const steps = stepLessonsByCourse(
      [
        { id: "l1", course_id: "c1", module_id: "m1" },
        { id: "ref", course_id: "c1", module_id: "handbook" },
      ],
      new Set(["handbook"]),
    );
    const { courses } = fold({
      enrollments: [row({ id: "e1" })],
      events: [event("e1", "l1", "lesson.completed", "2026-09-01T10:00:00Z")],
      lessonsByCourse: steps,
    });
    expect(courses.get("c1")).toMatchObject({ finished: 1, progressShare: 1 });
  });
});
