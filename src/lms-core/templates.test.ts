import { describe, expect, it } from "vitest";

import {
  COURSE_TEMPLATES,
  courseReadiness,
  findTemplate,
  flattenSteps,
  newCourseFromTemplate,
  PLACEHOLDER_MARKER,
  validateCourse,
} from "./index";

function counter() {
  let n = 0;
  return () => `id-${(n += 1)}`;
}

describe("every template", () => {
  for (const template of COURSE_TEMPLATES) {
    describe(template.id, () => {
      const course = newCourseFromTemplate(counter(), {
        slug: "demo",
        title: "Демо",
        programSlug: "way21",
        template: template.id,
      });

      it("validates the moment it is created", () => {
        expect(() => validateCourse(course, template.id)).not.toThrow();
      });

      it("leaves holes rather than inventing content", () => {
        expect(JSON.stringify(course)).toContain(PLACEHOLDER_MARKER);
        expect(courseReadiness(course).ready).toBe(false);
      });

      it("has at least one lesson the learner actually walks", () => {
        // A course whose every module is reference has zero steps: progress
        // reads "0 of 0" and it can never be finished.
        expect(flattenSteps(course).length).toBeGreaterThan(0);
      });

      it("gives every lesson a slug of its own", () => {
        // Slugs are unique across the whole course, not the module — they are
        // the URL key, and `validateCourse` refuses a duplicate.
        const slugs = course.modules.flatMap((entry) => entry.lessons.map((item) => item.slug));
        expect(new Set(slugs).size).toBe(slugs.length);
      });

      it("carries a boundary block when it asks anything of a body", () => {
        // The one blocker a template must never hand the author: it is not a
        // hole they left, it is one the template forgot.
        const blockers = courseReadiness(course).blockers;
        expect(blockers.some((blocker) => blocker.code === "lms_ready_missing_boundary")).toBe(false);
      });
    });
  }
});

describe("daily templates", () => {
  const course = newCourseFromTemplate(counter(), {
    slug: "p",
    title: "Практикум",
    programSlug: "reset-day",
    template: "practicum",
  });

  it("numbers the stepping lessons 1..N across modules", () => {
    expect(flattenSteps(course).map((entry) => entry.lesson.dayIndex)).toEqual([1, 2, 3, 4, 5]);
  });

  it("leaves reference material out of the day sequence", () => {
    const reference = course.modules.find((entry) => entry.reference);
    expect(reference?.lessons.every((item) => item.dayIndex === undefined)).toBe(true);
  });
});

describe("program template", () => {
  const course = newCourseFromTemplate(counter(), {
    slug: "w",
    title: "Програма",
    programSlug: "way21",
    template: "program",
  });

  it("really is twenty-one days, intro included", () => {
    // The tedium the template exists to remove is creating them by hand.
    const steps = flattenSteps(course);
    expect(steps.length).toBe(21);
    expect(steps.map((entry) => entry.lesson.dayIndex)).toEqual(
      Array.from({ length: 21 }, (_, index) => index + 1)
    );
  });

  it("never lets a lesson title disagree with its own day badge", () => {
    // «День 5» carrying dayIndex 6 is the tool contradicting itself on screen.
    for (const { lesson } of flattenSteps(course)) {
      const named = /День (\d+)/.exec(lesson.title);
      if (named) expect(lesson.dayIndex).toBe(Number(named[1]));
    }
  });
});

describe("findTemplate", () => {
  it("falls back to the blank one rather than throwing", () => {
    // The id arrives over HTTP; an unknown one is a payload, not a crash.
    expect(findTemplate("nonsense").id).toBe("blank");
    expect(findTemplate(undefined).id).toBe("blank");
  });
});

describe("theme", () => {
  it("is carried onto the course when the author picked one", () => {
    const course = newCourseFromTemplate(counter(), {
      slug: "t",
      title: "З гамою",
      programSlug: "way21",
      template: "blank",
      theme: { palette: "herbs" },
    });
    expect(course.theme).toEqual({ palette: "herbs" });
  });
});
