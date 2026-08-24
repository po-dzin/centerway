import { describe, expect, it } from "vitest";

import { lessonPagerLayout } from "./lessonNavigation";

describe("lessonPagerLayout", () => {
  it.each([
    { name: "hides one lesson", input: { isReference: false, hasPrevious: false, hasNext: false }, mode: "hidden" },
    { name: "hides reference material", input: { isReference: true, hasPrevious: true, hasNext: true }, mode: "hidden" },
    { name: "shows next on first", input: { isReference: false, hasPrevious: false, hasNext: true }, mode: "single" },
    { name: "shows both in middle", input: { isReference: false, hasPrevious: true, hasNext: true }, mode: "split" },
    { name: "shows previous on last", input: { isReference: false, hasPrevious: true, hasNext: false }, mode: "single" },
  ])("$name", ({ input, mode }) => {
    expect(lessonPagerLayout(input).mode).toBe(mode);
  });
});
