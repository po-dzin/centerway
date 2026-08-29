import { describe, expect, it } from "vitest";

import { lessonPagerLayout } from "./lessonNavigation";

describe("lessonPagerLayout", () => {
  it.each([
    {
      name: "hides the pager for a one-lesson course",
      input: { isReference: false, hasPrevious: false, hasNext: false },
      expected: { showPrevious: false, showNext: false, mode: "hidden" },
    },
    {
      name: "hides the pager for reference material",
      input: { isReference: true, hasPrevious: true, hasNext: true },
      expected: { showPrevious: false, showNext: false, mode: "hidden" },
    },
    {
      name: "shows only next on the first lesson",
      input: { isReference: false, hasPrevious: false, hasNext: true },
      expected: { showPrevious: false, showNext: true, mode: "single" },
    },
    {
      name: "shows both neighbours on a middle lesson",
      input: { isReference: false, hasPrevious: true, hasNext: true },
      expected: { showPrevious: true, showNext: true, mode: "split" },
    },
    {
      name: "shows only previous on the last lesson",
      input: { isReference: false, hasPrevious: true, hasNext: false },
      expected: { showPrevious: true, showNext: false, mode: "single" },
    },
  ])("$name", ({ input, expected }) => {
    expect(lessonPagerLayout(input)).toEqual(expected);
  });
});
