import { describe, expect, it } from "vitest";

import type { Lesson } from "@/lms-core";
import {
  exportLessonDocument,
  importLessonDocument,
  lessonDocumentFormat,
  lessonToMarkdown,
  lessonToText,
} from "./lessonDocuments";

function ids() {
  let index = 0;
  return () => `document-${++index}`;
}

const lesson: Lesson = {
  id: "lesson-1",
  slug: "dykhannia",
  title: "Дихальна практика",
  order: 1,
  summary: "Короткий вступ до практики.",
  blocks: [
    { id: "objective", type: "lesson_objective", text: "Відчути спокійний ритм." },
    {
      id: "prose",
      type: "rich_text",
      content: [
        { kind: "h3", text: "Підготовка" },
        { kind: "p", text: [{ text: "Сядьте ", bold: true }, { text: "зручно." }] },
        { kind: "ul", items: ["Розслабте плечі", "Заплющте очі"] },
      ],
    },
    { id: "check", type: "checklist", items: [{ id: "check-1", text: "Зробити три цикли" }] },
    { id: "quote", type: "quote", text: "Не поспішайте.", author: "CenterWay" },
    { id: "code", type: "code", code: "inhale(4);", language: "js" },
  ],
};

describe("lesson documents", () => {
  it("recognizes only the supported portable formats", () => {
    expect(lessonDocumentFormat("lesson.md")).toBe("md");
    expect(lessonDocumentFormat("lesson.docx")).toBe("docx");
    expect(lessonDocumentFormat("lesson.txt")).toBe("txt");
    expect(lessonDocumentFormat("legacy.doc")).toBeNull();
  });

  it("turns Markdown structure into typed lesson blocks and a collision-free slug", async () => {
    const source = `# Ранкова практика\n\nПочніть **спокійно**.\n\n- перший крок\n- другий крок\n\n- [ ] відмітити виконання\n\n> Дихайте рівно.\n\n\`\`\`js\nconst breath = 4;\n\`\`\`\n`;
    const imported = await importLessonDocument(
      { filename: "fallback.md", bytes: new TextEncoder().encode(source) },
      { ids: ids(), takenSlugs: ["rankova-praktyka"], order: 3, dayIndex: 5 },
    );

    expect(imported).toMatchObject({ title: "Ранкова практика", slug: "rankova-praktyka-2", order: 3, dayIndex: 5 });
    expect(imported.blocks.map((block) => block.type)).toEqual(["rich_text", "checklist", "quote", "code"]);
  });

  it("exports readable Markdown and plain text", () => {
    const markdown = lessonToMarkdown(lesson);
    const text = lessonToText(lesson);
    expect(markdown).toContain("# Дихальна практика");
    expect(markdown).toContain("- [ ] Зробити три цикли");
    expect(markdown).toContain("```js");
    expect(text).toContain("Дихальна практика");
    expect(text).not.toContain("```js");
  });

  it("creates a DOCX that can be imported back as an editable lesson", async () => {
    const file = await exportLessonDocument(lesson, "docx");
    expect(file.filename).toBe("dykhalna-praktyka.docx");
    expect(file.body.byteLength).toBeGreaterThan(1_000);

    const imported = await importLessonDocument(
      { filename: file.filename, mime: file.mime, bytes: file.body },
      { ids: ids(), takenSlugs: [], order: 1 },
    );
    expect(imported.title).toBe("Дихальна практика");
    expect(imported.blocks.length).toBeGreaterThan(0);
  });
});
