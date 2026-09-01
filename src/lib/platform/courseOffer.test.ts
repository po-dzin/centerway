import { describe, expect, it } from "vitest";

import { toOfferSurface } from "./courseOffer";
import type { Course } from "@/lms-core";

/**
 * What a buyer is told about a course, and who decided it.
 *
 * Three facts on the offer surface used to be DERIVED from the material because
 * the author had no field to say them in: the kind (from a lesson count), the
 * duration (from the same count), and the subtitle (cut out of the title at a
 * dash). All three now have fields, and all three derivations survive as the
 * fallback for the courses written before them — so every rule below is really
 * a pair: what the author says wins, and what happens when they have said
 * nothing must not change.
 */
function course(overrides: Partial<Course> = {}, lessons = 6): Course {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    slug: "demo",
    title: "Demo",
    programSlug: "demo",
    brand: "centerway",
    locale: "uk",
    translationGroupId: "demo",
    status: "published",
    version: 1,
    schedule: { mode: "open" },
    entitlementProductCodes: ["demo"],
    modules: [
      {
        id: "00000000-0000-4000-8000-000000000011",
        slug: "m1",
        title: "Module",
        order: 1,
        lessons: Array.from({ length: lessons }, (_, index) => ({
          id: `l${index}`,
          slug: `l${index}`,
          title: `Lesson ${index}`,
          order: index + 1,
          blocks: [{ id: `b${index}`, type: "rich_text" as const, content: [{ kind: "p" as const, text: "Текст." }] }],
        })),
      },
    ],
    ...overrides,
  };
}

describe("the kind badge", () => {
  it("prints the author's word, not the lesson count's opinion", () => {
    // Twelve lessons: the old rule would have called this a programme.
    expect(toOfferSurface(course({ kind: "checklist" }, 12)).tag).toBe("Чек-лист");
    expect(toOfferSurface(course({ kind: "mini" }, 12)).tag).toBe("Міні-курс");
    // Four lessons: the old rule would have called this a mini-course.
    expect(toOfferSurface(course({ kind: "course" }, 4)).tag).toBe("Курс");
  });

  it("still counts lessons when the author has not said", () => {
    expect(toOfferSurface(course({}, 4)).tag).toBe("Міні-курс");
    expect(toOfferSurface(course({}, 12)).tag).toBe("Програма");
  });

  it("gives a checklist the short page layout while keeping its own word", () => {
    // Two questions, two answers: what it is CALLED and which layout it gets.
    const checklist = toOfferSurface(course({ kind: "checklist" }, 12));
    expect(checklist.tag).toBe("Чек-лист");
    expect(checklist.surfaceType).toBe("mini-course");
  });
});

describe("the duration", () => {
  it("writes the grammar the author did not have to", () => {
    expect(toOfferSurface(course({ durationDays: 1 })).duration).toBe("1 день");
    expect(toOfferSurface(course({ durationDays: 3 })).duration).toBe("3 дні");
    expect(toOfferSurface(course({ durationDays: 21 })).duration).toBe("21 день");
    // The band that looks like it takes the singular and does not.
    expect(toOfferSurface(course({ durationDays: 11 })).duration).toBe("11 днів");
  });

  it("falls back to the count, in the unit the schedule implies", () => {
    expect(toOfferSurface(course({}, 6)).duration).toBe("6 уроків");
    expect(toOfferSurface(course({ schedule: { mode: "daily" } }, 6)).duration).toBe("6 днів");
  });
});

describe("the subtitle", () => {
  it("prefers the field over the dash the parser used to look for", () => {
    const surface = toOfferSurface(
      course({ title: "Розвантажувальний день — практикум", posttitle: "три дні без їжі" })
    );
    expect(surface.subtitle).toBe("три дні без їжі");
    // The title is still cut for the name: that rule is about the h1, not about
    // where the subtitle came from.
    expect(surface.title).toBe("Розвантажувальний день");
  });

  it("keeps parsing the dash for courses written before the field", () => {
    expect(toOfferSurface(course({ title: "Розвантажувальний день — практикум" })).subtitle).toBe("практикум");
  });

  it("says nothing when there is nothing to say", () => {
    expect(toOfferSurface(course({ title: "Шлях 21" })).subtitle).toBeUndefined();
  });
});

describe("the course-specific author note", () => {
  it("carries it to the offer surface without inventing one for another course", () => {
    expect(toOfferSurface(course({ authorNote: "Я створив цей курс для м’якого старту." })).authorNote)
      .toBe("Я створив цей курс для м’якого старту.");
    expect(toOfferSurface(course()).authorNote).toBeUndefined();
  });
});
