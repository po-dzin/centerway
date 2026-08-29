import { describe, expect, it } from "vitest";

import {
  LESSON_BLOCK_TYPES,
  moveItem,
  newBlock,
  newCourse,
  newLesson,
  newModule,
  PLACEHOLDER_MARKER,
  nextDayIndex,
  pruneEmptyProse,
  renumber,
  slugify,
  uniqueSlug,
  validateCourse,
  validateLessonBlock,
  courseReadiness,
  type Course,
  type LessonBlock,
} from "./index";

/** Deterministic ids: the factories take a source precisely so a test can. */
function counter() {
  let n = 0;
  return () => `id-${(n += 1)}`;
}

describe("newBlock", () => {
  it("produces a structurally valid block for every type in the vocabulary", () => {
    for (const type of LESSON_BLOCK_TYPES) {
      const block = newBlock(type, counter());
      expect(() => validateLessonBlock(block, `new:${type}`)).not.toThrow();
    }
  });

  it("marks every hole, so a fresh block is valid and unpublishable", () => {
    // The rule the whole authoring pipeline rests on: an agent — or a "+" —
    // may LEAVE a hole, it may not fill one in.
    for (const type of LESSON_BLOCK_TYPES) {
      const block = newBlock(type, counter());
      expect(JSON.stringify(block)).toContain(PLACEHOLDER_MARKER);
    }
  });

  it("gives a checklist item its own id, not the block's", () => {
    const block = newBlock("checklist", counter());
    if (block.type !== "checklist") throw new Error("wrong type");
    expect(block.items[0].id).not.toBe(block.id);
  });

  it("builds a table that is not ragged", () => {
    const block = newBlock("table", counter());
    if (block.type !== "table") throw new Error("wrong type");
    expect(block.rows.every((row) => row.length === block.head?.length)).toBe(true);
  });
});

describe("newCourse", () => {
  const course = newCourse(counter(), { slug: "fresh", title: "Свіжий курс", programSlug: "way21" });

  it("validates as a course the moment it exists", () => {
    expect(() => validateCourse(course, "fresh")).not.toThrow();
  });

  it("cannot be published yet", () => {
    expect(courseReadiness(course).ready).toBe(false);
  });

  it("is its own translation group — never a shared constant", () => {
    // One id source across both, so the ids are genuinely drawn in sequence
    // rather than each course restarting the counter at 1.
    const ids = counter();
    const first = newCourse(ids, { slug: "a", title: "Перший", programSlug: "way21" });
    const second = newCourse(ids, { slug: "b", title: "Другий", programSlug: "way21" });
    expect(first.translationGroupId).not.toBe(second.translationGroupId);
  });
});

describe("slugs", () => {
  it("transliterates Cyrillic instead of stripping it", () => {
    // Stripping would leave the empty string, and every lesson in a Ukrainian
    // course would then collide on the same fallback.
    expect(slugify("Розвантажувальний день")).toBe("rozvantazhuvalnyi-den");
  });

  it("falls back rather than returning nothing", () => {
    expect(slugify("!!!")).toBe("item");
  });

  it("suffixes until it stops colliding", () => {
    expect(uniqueSlug("День", ["den", "den-2"])).toBe("den-3");
  });
});

describe("moveItem", () => {
  it("clamps instead of throwing at the ends", () => {
    expect(moveItem([1, 2, 3], 0, -1)).toEqual([1, 2, 3]);
    expect(moveItem([1, 2, 3], 2, 5)).toEqual([1, 2, 3]);
  });

  it("moves without mutating the input", () => {
    const source = [1, 2, 3];
    expect(moveItem(source, 2, 0)).toEqual([3, 1, 2]);
    expect(source).toEqual([1, 2, 3]);
  });
});

describe("renumber", () => {
  it("rewrites order to match array position", () => {
    const ids = counter();
    const modules = [newModule(ids, { order: 7 }), newModule(ids, { order: 2 })];
    const renumbered = renumber(modules);
    expect(renumbered.map((module) => module.order)).toEqual([1, 2]);
    expect(renumbered[0].lessons[0].order).toBe(1);
  });
});

describe("nextDayIndex", () => {
  const ids = counter();
  const base: Course = {
    ...newCourse(ids, { slug: "daily", title: "Курс", programSlug: "way21" }),
    schedule: { mode: "daily" },
  };
  const gapped: Course = {
    ...base,
    modules: [
      {
        ...newModule(ids, { order: 1 }),
        lessons: [
          { ...newLesson(ids, { order: 1 }), dayIndex: 1 },
          { ...newLesson(ids, { order: 2 }), dayIndex: 7 },
        ],
      },
      { ...newModule(ids, { order: 2 }), reference: true },
    ],
  };

  it("takes the day after the last, leaving the gaps alone", () => {
    // way21 runs 1, 2, 3, 4, 7 on purpose: twenty-one days hold fewer than
    // twenty-one lessons, and day 7 means the seventh DAY.
    expect(nextDayIndex(gapped)).toBe(8);
  });

  it("ignores reference material, which holds no day", () => {
    expect(gapped.modules[1].lessons[0].dayIndex).toBeUndefined();
  });

  it("answers nothing at all on a non-daily course", () => {
    expect(nextDayIndex({ ...gapped, schedule: { mode: "open" } })).toBeUndefined();
  });
});

describe("pruneEmptyProse", () => {
  const course = (blocks: LessonBlock[]): Course =>
    ({
      modules: [{ lessons: [{ blocks }] }],
    }) as unknown as Course;

  const rich = (content: unknown[]): LessonBlock =>
    ({ id: "b1", type: "rich_text", content }) as unknown as LessonBlock;

  it("drops a paragraph the author opened and never wrote", () => {
    const pruned = pruneEmptyProse(course([rich([{ kind: "p", text: "Написане" }, { kind: "p", text: "" }])]));
    expect(pruned.modules[0].lessons[0].blocks[0]).toMatchObject({
      content: [{ kind: "p", text: "Написане" }],
    });
  });

  it("drops empty list items and keeps the ones with words in them", () => {
    const pruned = pruneEmptyProse(course([rich([{ kind: "ul", items: ["Перший", "", "Третій"] }])]));
    expect(pruned.modules[0].lessons[0].blocks[0]).toMatchObject({
      content: [{ kind: "ul", items: ["Перший", "Третій"] }],
    });
  });

  it("drops a block emptied of every node", () => {
    const pruned = pruneEmptyProse(course([rich([{ kind: "p", text: "" }])]));
    expect(pruned.modules[0].lessons[0].blocks).toEqual([]);
  });

  it("leaves every other block type exactly as it found it", () => {
    const video = { id: "v1", type: "video", youtubeId: "abc" } as unknown as LessonBlock;
    const pruned = pruneEmptyProse(course([video]));
    expect(pruned.modules[0].lessons[0].blocks[0]).toBe(video);
  });

  it("counts whitespace as nothing written", () => {
    const pruned = pruneEmptyProse(course([rich([{ kind: "p", text: "   " }, { kind: "p", text: "Є" }])]));
    expect(pruned.modules[0].lessons[0].blocks[0]).toMatchObject({ content: [{ kind: "p", text: "Є" }] });
  });
});
