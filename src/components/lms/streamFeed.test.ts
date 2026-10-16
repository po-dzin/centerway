import { describe, expect, it } from "vitest";
import type { CourseOutlineEntryDto } from "./lmsClient";
import { streamFeed } from "./streamFeed";

const day = (n: number, completed: boolean): CourseOutlineEntryDto => ({
  moduleId: "m",
  moduleTitle: "M",
  isReference: false,
  lessonId: `l${n}`,
  slug: `day-${n}`,
  title: `Day ${n}`,
  dayIndex: n,
  durationMin: null,
  completed,
  availability: { available: true } as CourseOutlineEntryDto["availability"],
});

describe("streamFeed", () => {
  const steps = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => day(n, n < 6));

  it("folds the done days before today and keeps the last two in view", () => {
    const feed = streamFeed(steps, "day-6", 6, false);
    expect(feed.folded).toBe(3);
    expect(feed.visible.map((step) => step.entry.dayIndex)).toEqual([4, 5, 6, 7, 8]);
    expect(feed.visible.map((step) => step.state)).toEqual(["done", "done", "current", "next", "next"]);
    expect(feed.visible.find((step) => step.today)?.entry.dayIndex).toBe(6);
  });

  it("shows everything when expanded", () => {
    expect(streamFeed(steps, "day-6", 6, true)).toMatchObject({ folded: 0 });
  });

  it("never folds a skipped day", () => {
    const skipped = steps.map((step) => (step.dayIndex === 2 ? { ...step, completed: false } : step));
    expect(streamFeed(skipped, "day-2", 6, false).folded).toBe(0);
  });

  it("folds nothing on the first days", () => {
    expect(
      streamFeed(
        steps.map((s) => ({ ...s, completed: false })),
        "day-1",
        1,
        false,
      ).folded,
    ).toBe(0);
  });
});
