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
      source.modules[0]!.id,
      source.modules[0]!.lessons![0]!.id,
      ...source.modules[0]!.lessons![0]!.blocks!.flatMap((block) => {
        if (block.type === "checklist" || block.type === "faq_block") {
          return [block.id, ...block.items.map((item) => item.id)];
        }
        return [block.id];
      }),
    ];
    const lesson = course.modules[0]!.lessons![0];
    const importedIds = [
      course.id,
      course.translationGroupId,
      course.modules[0]!.id,
      lesson!.id,
      ...lesson!.blocks!.flatMap((block) => {
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
    source.modules[0]!.lessons![0]!.blocks![0] = {
      id: "objective-source",
      type: "lesson_objective",
      text: "[ЗАПОВНИ: мету]",
    };

    const result = preparePortableCourse(source, { takenSlugs: [], ids: ids() });
    expect(result.course.status).toBe("draft");
    expect(result.readiness.blockers).toEqual([expect.objectContaining({ code: "lms_ready_placeholder" })]);
  });

  it("rejects a broken transfer instead of inventing missing structure", () => {
    const broken = { ...sourceCourse(), modules: [] };
    expect(() => preparePortableCourse(broken, { takenSlugs: [], ids: ids() })).toThrow(
      "lms_course_empty_modules:portable",
    );
  });
});

describe("author-written course JSON", () => {
  it("generates technical fields, route keys and nested identities without changing content", () => {
    const input = {
      title: "Практика",
      modules: [
        {
          title: "Початок",
          lessons: [
            {
              title: "Вступ",
              blocks: [
                { type: "checklist", items: [{ text: "Крок" }] },
                { type: "group", children: [{ type: "quote", text: "Цитата" }] },
              ],
            },
          ],
        },
      ],
    };
    const { course } = preparePortableCourse(input, { takenSlugs: [], ids: ids() });
    expect(course).toMatchObject({
      status: "draft",
      version: 1,
      locale: "uk",
      visibility: "hidden",
      entitlementProductCodes: [],
      schedule: { mode: "open" },
    });
    expect(course.modules[0]).toMatchObject({ order: 1, lessons: [{ order: 1 }] });
    expect(() => validateCourse(course)).not.toThrow();
    expect(input.modules[0]!.lessons[0]!.blocks[0]).not.toHaveProperty("id");
  });

  it("still refuses missing authored block content", () => {
    expect(() =>
      preparePortableCourse(
        {
          title: "Курс",
          modules: [{ title: "Модуль", lessons: [{ title: "Урок", blocks: [{ type: "rich_text", content: [] }] }] }],
        },
        { takenSlugs: [], ids: ids() },
      ),
    ).toThrow("lms_block_empty_content:portable.modules[0].lessons[0].blocks[0]");
  });

  it("keeps the target identity, access and unchanged lesson/checklist progress", async () => {
    const { portableCourseUpdate } = await import("./portable");
    const target = sourceCourse();
    const imported = preparePortableCourse(target, { takenSlugs: [target.slug], ids: ids() }).course;
    const update = portableCourseUpdate(imported, target);
    expect(update).toMatchObject({
      id: target.id,
      slug: target.slug,
      entitlementProductCodes: target.entitlementProductCodes,
      visibility: "listed",
      status: "draft",
    });
    expect(update.modules[0]!.lessons[0]).toEqual(target.modules[0]!.lessons[0]);
    expect(() => validateCourse(update)).not.toThrow();
  });
});

describe("portable internal references", () => {
  it("remaps internal lesson and block links on copy and on update", async () => {
    const { internalBlockReferenceHref, internalLessonReferenceHref, portableCourseUpdate } = await import("./index");
    const source = sourceCourse();
    const lesson = source.modules[0]!.lessons[0]!;
    lesson.blocks.push({
      id: "links",
      type: "rich_text",
      content: [
        {
          kind: "p",
          text: [
            { text: "Урок", href: internalLessonReferenceHref(lesson.id) },
            { text: "Мета", href: internalBlockReferenceHref(lesson.id, lesson.blocks[0]!.id) },
          ],
        },
      ],
    });
    const copy = preparePortableCourse(source, { takenSlugs: [], ids: ids() }).course;
    const copiedLesson = copy.modules[0]!.lessons[0]!;
    const link = copiedLesson.blocks.at(-1)!;
    expect(JSON.stringify(link)).toContain(internalLessonReferenceHref(copiedLesson.id));
    expect(JSON.stringify(link)).toContain(internalBlockReferenceHref(copiedLesson.id, copiedLesson.blocks[0]!.id));
    const updated = portableCourseUpdate(copy, source).modules[0]!.lessons[0]!;
    expect(JSON.stringify(updated.blocks.at(-1))).toContain(internalLessonReferenceHref(lesson.id));
    expect(JSON.stringify(updated.blocks.at(-1))).toContain(
      internalBlockReferenceHref(lesson.id, lesson.blocks[0]!.id),
    );
  });
});
