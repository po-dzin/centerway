/**
 * Content gate for data/courses/**.
 *
 * Runs as `npm run lms:validate` before any seed, so invalid authored content
 * never reaches the database.
 */

import { describe, expect, it } from "vitest";

import { listCourses, getCourse, getCourseByProgram } from "./catalog";
import { countLessons, flattenLessons, flattenReference, flattenSteps } from "@/lms-core";

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
    expect(getCourseByProgram("reset-day")?.slug).toBe("reset-day");
  });

  it("keeps the three reset-day stages, whatever reference lessons surround them", () => {
    // The protocol is three stages: preparation, the day itself, the exit.
    // Reference lessons (intro, routine) may come and go — the stages may not.
    const course = getCourse("reset-day")!;
    const slugs = flattenLessons(course).map((entry) => entry.lesson.slug);
    expect(slugs).toEqual(expect.arrayContaining(["day-1", "day-2", "day-3"]));
    expect(countLessons(course)).toBeGreaterThanOrEqual(3);
  });

  it("keeps recipes out of the protocol flow", () => {
    // Reference material must never become "the next step": finishing stage 3
    // has to end the course, not hand the learner a recipe list.
    const course = getCourse("reset-day")!;
    const stepSlugs = flattenSteps(course).map((entry) => entry.lesson.slug);
    const referenceSlugs = flattenReference(course).map((entry) => entry.lesson.slug);

    expect(referenceSlugs).toContain("recipes");
    expect(stepSlugs).not.toContain("recipes");
    expect(stepSlugs[stepSlugs.length - 1]).toBe("day-3");
    // Progress counts steps only.
    expect(countLessons(course)).toBe(stepSlugs.length);
  });

  it("offers exactly six ways through the reset-day fasting day", () => {
    // Six variants is the author's protocol, not an arbitrary number: dropping
    // one silently would leave learners without the option they were sold.
    const course = getCourse("reset-day")!;
    const day2 = flattenLessons(course).find((entry) => entry.lesson.slug === "day-2");
    const variants = (day2?.lesson.blocks ?? []).filter(
      (block) => block.type === "practice_block" && /^\d\./.test(
        typeof block.title === "string" ? block.title : block.title.map((span) => span.text).join("")
      )
    );
    expect(variants).toHaveLength(6);
  });

  it("returns null for an unknown slug instead of throwing", () => {
    expect(getCourse("nope")).toBeNull();
  });
});
