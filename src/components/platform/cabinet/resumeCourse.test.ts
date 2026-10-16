import { describe, expect, it } from "vitest";

import type { LearnerShelfCourseDto } from "@/components/lms/lmsClient";
import { heldCourses, pickResumeCourse } from "./resumeCourse";

function course(
  slug: string,
  lastActivityAt: string | null,
  overrides: Partial<LearnerShelfCourseDto> = {},
): LearnerShelfCourseDto {
  return {
    slug,
    title: slug,
    programSlug: slug,
    status: "published",
    scheduleMode: "open",
    summary: null,
    access: "enrolled",
    lockReason: null,
    startedAt: "2026-08-01T08:00:00.000Z",
    expiresAt: null,
    daysLeft: null,
    source: "order",
    lastActivityAt,
    standing: { totalLessons: 3, completedLessons: 1, currentDay: null, startsInDays: null, isFinished: false },
    currentLessonSlug: "lesson-2",
    currentLessonTitle: "Lesson 2",
    cover: null,
    categories: [],
    includedIn: null,
    carries: [],
    ...overrides,
  };
}

describe("pickResumeCourse", () => {
  it("picks the most recently active unfinished course regardless of shelf order", () => {
    const older = course("older", "2026-08-20T09:00:00.000Z");
    const latest = course("latest", "2026-08-23T18:30:00.000Z");

    expect(pickResumeCourse([older, latest])?.slug).toBe("latest");
    expect(pickResumeCourse([latest, older])?.slug).toBe("latest");
  });

  it("falls back to enrollment time for legacy progress without activity", () => {
    const oldEnrollment = course("old", null, { startedAt: "2026-08-01T08:00:00.000Z" });
    const newEnrollment = course("new", null, { startedAt: "2026-08-18T08:00:00.000Z" });

    expect(pickResumeCourse([oldEnrollment, newEnrollment])?.slug).toBe("new");
  });

  it("ignores finished courses and falls back to a paid unopened course", () => {
    const finished = course("finished", "2026-08-23T18:30:00.000Z", {
      standing: { totalLessons: 3, completedLessons: 3, currentDay: null, startsInDays: null, isFinished: true },
    });
    const available = course("available", null, {
      access: "available",
      startedAt: null,
      standing: null,
      currentLessonSlug: null,
      currentLessonTitle: null,
    });

    expect(pickResumeCourse([finished, available])?.slug).toBe("available");
  });

  it("uses the latest completed course when nothing can be started or resumed", () => {
    const older = course("older-finished", "2026-08-12T10:00:00.000Z", {
      standing: { totalLessons: 3, completedLessons: 3, currentDay: null, startsInDays: null, isFinished: true },
    });
    const latest = course("latest-finished", "2026-08-22T10:00:00.000Z", {
      standing: { totalLessons: 3, completedLessons: 3, currentDay: null, startsInDays: null, isFinished: true },
    });

    expect(pickResumeCourse([older, latest])?.slug).toBe("latest-finished");
  });
});

describe("heldCourses", () => {
  const untouchedFree = course("soul-daily-ritual", null, {
    access: "available",
    source: "free",
    startedAt: null,
    standing: null,
    currentLessonSlug: null,
    currentLessonTitle: null,
  });

  it("leaves out a free course nobody has started, so an empty cabinet stays empty", () => {
    expect(heldCourses([untouchedFree])).toEqual([]);
  });

  it("counts a free course once it is started", () => {
    const started = course("soul-daily-ritual", "2026-10-16T08:00:00.000Z", { source: "free" });
    expect(heldCourses([started])).toEqual([started]);
  });

  it("keeps a paid course that has not been opened yet, and drops locked ones", () => {
    const paid = course("way21", null, { access: "available", source: "order", startedAt: null });
    const locked = course("reset-day", null, { access: "locked" });
    expect(heldCourses([paid, locked, untouchedFree])).toEqual([paid]);
  });
});
