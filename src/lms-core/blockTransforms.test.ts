import { describe, expect, it } from "vitest";
import { changeNodeKind, transformRichNode } from "./blockTransforms";
import { addressedBlocks, collectRequiredChecklistItemIds, flattenBlocks, validateLessonBlock, type LessonBlock, type RichTextBlock } from "./blocks";
import { newCourse, pruneEmptyProse, renumberSteps } from "./drafts";
import { courseReadiness } from "./readiness";
import { preparePortableCourse } from "./portable";
import { lessonToMarkdown } from "../lib/lms/lessonDocuments";
import { LESSON_BLOCK_RECIPES, newBlockRecipe } from "./composition";

const ids = () => { let n = 0; return () => `generated-${++n}`; };
const marked = [{ text: "Важливе", bold: true }, { text: " посилання", href: "https://example.org" }];
const prose: RichTextBlock = { id: "prose", type: "rich_text", content: [
  { kind: "p", text: "Перед" }, { kind: "p", text: marked }, { kind: "p", text: "Після" },
] };

describe("non-destructive text modifiers", () => {
  it("changes only the addressed paragraph into a list and retains spans", () => {
    const list = changeNodeKind(prose.content, 1, "ul");
    expect(list).toEqual([prose.content[0], { kind: "ul", items: [marked] }, prose.content[2]]);
    expect(changeNodeKind(list, 1, "p")).toEqual(prose.content);
  });
  it("preserves all list items and inline marks when changing to a heading", () => {
    expect(changeNodeKind([{ kind: "ol", items: [marked, "Другий"] }], 0, "h3"))
      .toEqual([{ kind: "h3", text: [...marked, { text: "; " }, { text: "Другий" }] }]);
  });
  it.each(["quote", "code", "checklist"] as const)("replaces the current node with %s without losing neighbours", (kind) => {
    const converted = transformRichNode(prose, 1, kind, ids());
    expect(converted.map((b) => b.type)).toEqual(["rich_text", kind, "rich_text"]);
    expect(converted[0]).toEqual({ ...prose, content: [prose.content[0]] });
    expect(converted[2]).toMatchObject({ content: [prose.content[2]] });
    expect(new Set(converted.map((b) => b.id)).size).toBe(3);
    if (kind === "quote") expect(converted[1]).toMatchObject({ text: marked });
    if (kind === "code") expect(converted[1]).toMatchObject({ code: "Важливе посилання" });
    if (kind === "checklist") expect(converted[1]).toMatchObject({ items: [{ text: marked }] });
    expect(prose.content).toHaveLength(3);
  });
});

describe("composite block contracts", () => {
  it("assembles every catalog preset from valid semantic subblocks", () => {
    for (const kind of Object.keys(LESSON_BLOCK_RECIPES) as (keyof typeof LESSON_BLOCK_RECIPES)[]) {
      const block = newBlockRecipe(kind, ids());
      expect(block.type).toBe("group");
      expect(flattenBlocks([block]).map((child) => child.type)).toEqual(LESSON_BLOCK_RECIPES[kind]);
      expect(() => validateLessonBlock(block, kind)).not.toThrow();
    }
  });
  const group: LessonBlock = { id: "group", type: "group", children: [
    { id: "step", type: "protocol_step", title: "Крок", step: 8 },
    { id: "boundary", type: "boundary_note", text: "Межі" },
    { id: "checklist", type: "checklist", requiredForCompletion: true, items: [{ id: "item", text: marked }] },
    prose,
  ] };
  it("validates, preserves required progress IDs and renumbers nested steps", () => {
    expect(() => validateLessonBlock(group, "group")).not.toThrow();
    expect(collectRequiredChecklistItemIds([group])).toEqual(["item"]);
    expect(flattenBlocks(renumberSteps([group]))[0]).toMatchObject({ step: 1 });
    expect(addressedBlocks([group])[1].path).toBe("blocks[0].children[0]");
  });
  it("rejects empty and excessively nested composites", () => {
    expect(() => validateLessonBlock({ ...group, children: [] }, "group")).toThrow("empty_group");
    let nested: LessonBlock = prose;
    for (let i = 0; i < 6; i++) nested = { id: `group-${i}`, type: "group", children: [nested] };
    expect(() => validateLessonBlock(nested, "group")).toThrow("nesting_limit");
  });
  it("keeps nested boundaries, export text and fresh import identities", () => {
    const course = newCourse(ids(), { slug: "test", title: "Курс", programSlug: "test" });
    course.title = "Курс";
    const lesson = course.modules[0].lessons[0];
    lesson.blocks = [group];
    expect(courseReadiness(course).blockers.some((b) => b.code === "lms_ready_missing_boundary")).toBe(false);
    expect(lessonToMarkdown(lesson)).toContain("**Важливе**");
    const copy = preparePortableCourse(course, { takenSlugs: [], ids: ids() }).course;
    expect(collectRequiredChecklistItemIds(copy.modules[0].lessons[0].blocks)).not.toContain("item");
    lesson.blocks = [{ id: "empty-group", type: "group", children: [{ id: "empty", type: "rich_text", content: [{ kind: "p", text: "" }] }] }, group];
    expect(pruneEmptyProse(course).modules[0].lessons[0].blocks).toEqual([group]);
  });
});
