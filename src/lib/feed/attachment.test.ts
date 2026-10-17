import { describe, expect, it } from "vitest";

import { blockAttachment, programAttachment } from "./attachment";

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
