/**
 * Content gate for data/courses/**.
 *
 * Runs as `npm run lms:validate` before any seed, so invalid authored content
 * never reaches the database.
 *
 * These files stopped being the source of truth on 2026-08-21 — they are the
 * SNAPSHOT the live catalog falls back to (src/lib/lms/liveCatalog.ts). The
 * gate matters more for it, not less: a snapshot is only worth falling back to
 * if it is known good.
 */

import { describe, expect, it } from "vitest";

import { snapshotCourses, getSnapshotCourse, getSnapshotCourseByProgram } from "./catalog";
import { countLessons, courseReadiness, flattenLessons, flattenReference, flattenSteps, formatReadiness } from "@/lms-core";

describe("course catalog", () => {
  it("loads and validates every authored course", () => {
    // Module load already ran validateCourse; reaching here means all passed.
    expect(snapshotCourses().length).toBeGreaterThan(0);
  });

  it("keeps slugs unique across courses", () => {
    const slugs = snapshotCourses().map((course) => course.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("keeps lesson ids globally unique so progress events cannot collide", () => {
    const ids = snapshotCourses().flatMap((course) => flattenLessons(course).map((entry) => entry.lesson.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("uses uuid-shaped ids, matching the database primary keys", () => {
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    for (const course of snapshotCourses()) {
      expect(course.id, `course ${course.slug}`).toMatch(uuid);
      for (const courseModule of course.modules) {
        expect(courseModule.id, `module ${courseModule.slug}`).toMatch(uuid);
        for (const lesson of courseModule.lessons) {
          expect(lesson.id, `lesson ${lesson.slug}`).toMatch(uuid);
        }
      }
    }
  });

  it("starts every daily course on day 1 and keeps its days strictly increasing", () => {
    // Days may be sparse: a three-week protocol is authored per week, so a
    // lesson lands on day 8 while days 9 and 11 carry no new step. What must
    // hold is that the walk opens on day 1 and never goes backwards, because
    // both the drip gate and the reminder cron read the day sequence in order.
    for (const course of snapshotCourses()) {
      if (course.schedule.mode !== "daily") continue;
      const days = flattenSteps(course).map((entry) => entry.lesson.dayIndex ?? 0);
      expect(days[0], `course ${course.slug} does not start on day 1`).toBe(1);
      for (let index = 1; index < days.length; index += 1) {
        expect(
          days[index] > days[index - 1],
          `course ${course.slug}: day ${days[index]} does not follow day ${days[index - 1]}`
        ).toBe(true);
      }
    }
  });

  it("never publishes a course that still owes the learner content", () => {
    // The publish gate. A draft may carry [ЗАПОВНИ] markers, empty video ids and
    // dead links — that is what a draft is for. A published course may not.
    for (const course of snapshotCourses()) {
      if (course.status !== "published") continue;
      const readiness = courseReadiness(course);
      expect(readiness.ready, `course ${course.slug} is not publishable:\n${formatReadiness(readiness)}`).toBe(true);
    }
  });

  it("carries a boundary note on every body-facing protocol course", () => {
    // Bounded health claims are a brand-contract invariant, not a nicety.
    for (const course of snapshotCourses()) {
      if (course.schedule.mode !== "daily") continue;
      const hasBoundary = flattenLessons(course).some((entry) =>
        entry.lesson.blocks.some((block) => block.type === "boundary_note")
      );
      expect(hasBoundary, `course ${course.slug} has no boundary_note`).toBe(true);
    }
  });

  it("resolves reset-day by slug and by program", () => {
    const bySlug = getSnapshotCourse("reset-day");
    expect(bySlug).not.toBeNull();
    expect(getSnapshotCourseByProgram("reset-day")?.slug).toBe("reset-day");
  });

  it("keeps the three reset-day stages, whatever reference lessons surround them", () => {
    // The protocol is three stages: preparation, the day itself, the exit.
    // Reference lessons (intro, routine) may come and go — the stages may not.
    const course = getSnapshotCourse("reset-day")!;
    const slugs = flattenLessons(course).map((entry) => entry.lesson.slug);
    expect(slugs).toEqual(expect.arrayContaining(["day-1", "day-2", "day-3"]));
    expect(countLessons(course)).toBeGreaterThanOrEqual(3);
  });

  it("keeps recipes out of the protocol flow", () => {
    // Reference material must never become "the next step": finishing stage 3
    // has to end the course, not hand the learner a recipe list.
    const course = getSnapshotCourse("reset-day")!;
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
    const course = getSnapshotCourse("reset-day")!;
    const day2 = flattenLessons(course).find((entry) => entry.lesson.slug === "day-2");
    const variants = (day2?.lesson.blocks ?? []).filter(
      (block) => block.type === "practice_block" && /^\d\./.test(
        typeof block.title === "string" ? block.title : block.title.map((span) => span.text).join("")
      )
    );
    expect(variants).toHaveLength(6);
  });

  it("returns null for an unknown slug instead of throwing", () => {
    expect(getSnapshotCourse("nope")).toBeNull();
  });
});
