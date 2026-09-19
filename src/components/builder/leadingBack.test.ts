import { describe, expect, it } from "vitest";

import { BACK_TO_COURSE, leadingBack } from "./leadingBack";

/**
 * The phone's way back, for every trail the workshop builds.
 *
 * Each case is a screen: the shelf, a course, a lesson inside a module. The
 * two things that can be wrong are WHERE the arrow goes and WHAT it says, and
 * a wrong answer here is wrong on every builder screen at once.
 */
const toShelf = () => {};

describe("leadingBack", () => {
  it("has no way back at the workshop's root — the island is the mark", () => {
    expect(leadingBack([])).toBeNull();
    expect(leadingBack([{ label: "Майстерня" }])).toBeNull();
    expect(leadingBack([{ label: "Майстерня", href: "/build" }])).toBeNull();
  });

  it("goes from a course to the shelf and says the shelf's name", () => {
    const back = leadingBack([{ label: "Матеріали", onNavigate: toShelf }, { label: "Новий курс 3" }]);
    expect(back?.step.onNavigate).toBe(toShelf);
    expect(back?.text).toBe("Матеріали");
  });

  /* The case `length - 2` got wrong: the module has no page, so the way back
     from a lesson skips it and lands on the course. */
  it("skips a module with no route and goes from a lesson to its course", () => {
    const course = { label: "Розвантажувальний день — практикум з умовного голодування", href: "/build/reset-day" };
    const back = leadingBack([
      { label: "Матеріали", href: "/build/courses" },
      course,
      { label: "Модуль 1" },
      { label: "Урок 1" },
    ]);
    expect(back?.step).toBe(course);
  });

  /* A course title in the island came back as an ellipsis fragment; the word
     is the level, whatever the course is called. */
  it("names the course level, never the course's title", () => {
    const back = leadingBack([
      { label: "Матеріали", href: "/build/courses" },
      { label: "Розвантажувальний день — практикум з умовного голодування", href: "/build/reset-day" },
      { label: "Урок 1" },
    ]);
    expect(back?.text).toBe(BACK_TO_COURSE);
    expect(back?.text).not.toContain("Розвантажувальний");
  });

  it("never points at the screen it is on", () => {
    const back = leadingBack([
      { label: "Матеріали", href: "/build/courses" },
      { label: "Новий курс 3", href: "/build/novyi-kurs-3" },
    ]);
    expect(back?.step.href).toBe("/build/courses");
  });

  it("falls back to the root when nothing deeper has a route", () => {
    const back = leadingBack([
      { label: "Матеріали", href: "/build/courses" },
      { label: "Модуль 1" },
      { label: "Урок 1" },
    ]);
    expect(back?.step.href).toBe("/build/courses");
    expect(back?.text).toBe("Матеріали");
  });
});
