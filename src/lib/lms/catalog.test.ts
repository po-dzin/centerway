/**
 * Content gate for data/courses/**.
 *
 * Runs as `npm run lms:validate` before any seed, so invalid authored content
 * never reaches the database.
 */

import { describe, expect, it } from "vitest";

import { listCourses, getCourse, getCourseByProgram } from "./catalog";
import { countLessons, flattenLessons } from "@/lms-core";

describe("course catalog", () => {
  it("loads and validates every authored course", () => {
    // Module load already ran validateCourse; reaching here means all passed.
    expect(listCourses().length).toBeGreaterThan(0);
  });

  it("keeps slugs unique across courses", () => {
    const slugs = listCourses().map((course) => course.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("keeps lesson ids globally unique so progress events cannot collide", () => {
    const ids = listCourses().flatMap((course) => flattenLessons(course).map((entry) => entry.lesson.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("uses uuid-shaped ids, matching the database primary keys", () => {
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    for (const course of listCourses()) {
      expect(course.id, `course ${course.slug}`).toMatch(uuid);
      for (const courseModule of course.modules) {
        expect(courseModule.id, `module ${courseModule.slug}`).toMatch(uuid);
        for (const lesson of courseModule.lessons) {
          expect(lesson.id, `lesson ${lesson.slug}`).toMatch(uuid);
        }
      }
    }
  });

  it("gives every daily course a contiguous day sequence starting at 1", () => {
    for (const course of listCourses()) {
      if (course.schedule.mode !== "daily") continue;
      const days = flattenLessons(course)
        .map((entry) => entry.lesson.dayIndex ?? 0)
        .sort((a, b) => a - b);
      expect(days, `course ${course.slug}`).toEqual(days.map((_, index) => index + 1));
    }
  });

  it("carries a boundary note on every body-facing protocol course", () => {
    // Bounded health claims are a brand-contract invariant, not a nicety.
    for (const course of listCourses()) {
      if (course.schedule.mode !== "daily") continue;
      const hasBoundary = flattenLessons(course).some((entry) =>
        entry.lesson.blocks.some((block) => block.type === "boundary_note")
      );
      expect(hasBoundary, `course ${course.slug} has no boundary_note`).toBe(true);
    }
  });

  it("resolves reset-day by slug and by program", () => {
    const bySlug = getCourse("reset-day");
    expect(bySlug).not.toBeNull();
    expect(countLessons(bySlug!)).toBe(3);
    expect(getCourseByProgram("reset-day")?.slug).toBe("reset-day");
  });

  it("returns null for an unknown slug instead of throwing", () => {
    expect(getCourse("nope")).toBeNull();
  });
});
