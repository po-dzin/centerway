import { describe, expect, it } from "vitest";

import type { LearnerShelfCourseDto } from "@/components/lms/lmsClient";
import { pickResumeCourse } from "./resumeCourse";

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
    lastActivityAt,
    standing: { totalLessons: 3, completedLessons: 1, currentDay: null, isFinished: false },
    currentLessonSlug: "lesson-2",
    currentLessonTitle: "Lesson 2",
    cover: null,
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
      standing: { totalLessons: 3, completedLessons: 3, currentDay: null, isFinished: true },
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
      standing: { totalLessons: 3, completedLessons: 3, currentDay: null, isFinished: true },
    });
    const latest = course("latest-finished", "2026-08-22T10:00:00.000Z", {
      standing: { totalLessons: 3, completedLessons: 3, currentDay: null, isFinished: true },
    });

    expect(pickResumeCourse([older, latest])?.slug).toBe("latest-finished");
  });
});
