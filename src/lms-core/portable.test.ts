import { describe, expect, it } from "vitest";

import { preparePortableCourse } from "./portable";
import { validateCourse, type Course } from "./course";

function sourceCourse(): Course {
  return {
    id: "course-source",
    slug: "portable-course",
    title: "Переносимий курс",
    programSlug: "reset-day",
    brand: "centerway",
    locale: "uk",
    translationGroupId: "translation-source",
    status: "published",
    version: 7,
    schedule: { mode: "open" },
    entitlementProductCodes: ["course:portable-course"],
    visibility: "listed",
    sortOrder: 4,
    modules: [
      {
        id: "module-source",
        slug: "start",
        title: "Початок",
        order: 1,
        lessons: [
          {
            id: "lesson-source",
            slug: "welcome",
            title: "Вступ",
            order: 1,
            blocks: [
              { id: "objective-source", type: "lesson_objective", text: "Зрозуміти маршрут." },
              {
                id: "checklist-source",
                type: "checklist",
                items: [{ id: "check-source", text: "Відкрити матеріали" }],
              },
              {
                id: "faq-source",
                type: "faq_block",
                items: [{ id: "faq-item-source", question: "Коли?", answer: "Коли зручно." }],
              },
            ],
          },
        ],
      },
    ],
  };
}

function ids() {
  let index = 0;
  return () => `fresh-${++index}`;
}

describe("preparePortableCourse", () => {
  it("creates a hidden, commerce-detached draft with a non-colliding slug", () => {
    const source = sourceCourse();
    const result = preparePortableCourse(source, {
      takenSlugs: ["portable-course"],
      ids: ids(),
    });

    expect(result.course).toMatchObject({
      slug: "portable-course-2",
      status: "draft",
      version: 1,
      visibility: "hidden",
      entitlementProductCodes: [],
    });
    expect("sortOrder" in result.course).toBe(false);
    expect(result.summary).toMatchObject({ moduleCount: 1, lessonCount: 1, blockCount: 3 });
    expect(() => validateCourse(result.course, "test.import")).not.toThrow();

    // Previewing must not edit the object the browser parsed from the file.
    expect(source).toMatchObject({ status: "published", visibility: "listed", version: 7, sortOrder: 4 });
  });

  it("remaps every identity, including progress-bearing nested item ids", () => {
    const source = sourceCourse();
    const { course } = preparePortableCourse(source, { takenSlugs: [], ids: ids() });

    const sourceIds = [
      source.id,
      source.translationGroupId,
      source.modules[0].id,
      source.modules[0].lessons[0].id,
      ...source.modules[0].lessons[0].blocks.flatMap((block) => {
        if (block.type === "checklist" || block.type === "faq_block") {
          return [block.id, ...block.items.map((item) => item.id)];
        }
        return [block.id];
      }),
    ];
    const lesson = course.modules[0].lessons[0];
    const importedIds = [
      course.id,
      course.translationGroupId,
      course.modules[0].id,
      lesson.id,
      ...lesson.blocks.flatMap((block) => {
        if (block.type === "checklist" || block.type === "faq_block") {
          return [block.id, ...block.items.map((item) => item.id)];
        }
        return [block.id];
      }),
    ];

    expect(importedIds).toHaveLength(new Set(importedIds).size);
    expect(importedIds.some((id) => sourceIds.includes(id))).toBe(false);
  });

  it("reports readiness blockers without refusing a structurally valid draft", () => {
    const source = sourceCourse();
    source.modules[0].lessons[0].blocks[0] = {
      id: "objective-source",
      type: "lesson_objective",
      text: "[ЗАПОВНИ: мету]",
    };

    const result = preparePortableCourse(source, { takenSlugs: [], ids: ids() });
    expect(result.course.status).toBe("draft");
    expect(result.readiness.blockers).toEqual([
      expect.objectContaining({ code: "lms_ready_placeholder" }),
    ]);
  });

  it("rejects a broken transfer instead of inventing missing structure", () => {
    const broken = { ...sourceCourse(), modules: [] };
    expect(() => preparePortableCourse(broken, { takenSlugs: [], ids: ids() })).toThrow(
      "lms_course_empty_modules:portable",
    );
  });
});
