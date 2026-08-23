import { describe, expect, it } from "vitest";

import type { Course } from "@/lms-core";
import { courseRevisionHash } from "./revisions";

describe("course revision hash", () => {
  it("is stable across object key order", () => {
    const left = { id: "course", title: "Курс", modules: [{ id: "m", title: "Модуль" }] } as unknown as Course;
    const right = { modules: [{ title: "Модуль", id: "m" }], title: "Курс", id: "course" } as unknown as Course;
    expect(courseRevisionHash(left)).toBe(courseRevisionHash(right));
  });

  it("changes when ordered content changes", () => {
    const first = { id: "course", modules: ["a", "b"] } as unknown as Course;
    const second = { id: "course", modules: ["b", "a"] } as unknown as Course;
    expect(courseRevisionHash(first)).not.toBe(courseRevisionHash(second));
  });
});
