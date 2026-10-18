import { describe, expect, it } from "vitest";

import { attachmentPath, blockAttachment, programAttachment } from "./attachment";

const course = { title: "Шлях 21", slug: "way21", programSlug: "way21" };
const practice = {
  id: "b1",
  type: "practice_block" as const,
  title: "Ранковий протокол",
  text: "Сядьте рівно. ".repeat(60),
  durationMin: 20,
};
const lesson = { title: "Урок 3", dayIndex: 3, blocks: [practice] };

describe("blockAttachment", () => {
  it("shown whole carries the block itself", () => {
    const card = blockAttachment(course, lesson, "b1", true);
    expect(card.block?.id).toBe("b1");
    expect(card.href).toBe("/programs/way21");
    expect(card.meta).toBe("Шлях 21 · день 3");
  });

  it("an excerpt carries its opening words and no block", () => {
    const card = blockAttachment(course, lesson, "b1", false);
    expect(card.block).toBeNull();
    expect(card.text.endsWith("…")).toBe(true);
    expect(card.text.length).toBeLessThan(practice.text.length);
  });

  it("a deleted block falls back to the lesson's title", () => {
    const card = blockAttachment(course, lesson, "gone", true);
    expect(card.title).toBe("Урок 3");
    expect(card.block).toBeNull();
  });
});

describe("programAttachment", () => {
  it("points at the programme page", () => {
    expect(programAttachment({ ...course, programSlug: null }).href).toBeNull();
    expect(programAttachment(course).title).toBe("Шлях 21");
  });
});

describe("attachmentPath", () => {
  const withSlug = { ...lesson, slug: "den-3" };

  it("takes a reader with the course to the lesson and the block", () => {
    const card = blockAttachment(course, withSlug, "b1", false);
    expect(attachmentPath(card, true)).toBe("/learn/way21/den-3#block-b1");
  });

  it("takes a reader without it to where the programme is bought", () => {
    const card = blockAttachment(course, withSlug, "b1", true);
    expect(attachmentPath(card, false)).toBe("/programs/way21");
  });

  it("takes a reader with a programme card to the course's own page", () => {
    expect(attachmentPath(programAttachment(course), true)).toBe("/learn/way21");
  });
});
