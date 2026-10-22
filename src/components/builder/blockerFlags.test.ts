import { describe, expect, it } from "vitest";

import type { Course, ReadinessBlocker } from "@/lms-core";
import { blockerFlags } from "./blockerFlags";

const course = {
  slug: "way21",
  title: "Шлях",
  modules: [
    {
      id: "m1",
      slug: "week-1",
      title: "Тиждень 1",
      lessons: [
        {
          id: "l1",
          slug: "day-1",
          title: "День 1",
          blocks: [
            { id: "b1", type: "rich_text" },
            { id: "b2", type: "table" },
          ],
        },
        { id: "l2", slug: "day-2", title: "День 2", blocks: [{ id: "b3", type: "video" }] },
      ],
    },
  ],
} as unknown as Course;

const blocker = (path: string, code = "lms_ready_placeholder"): ReadinessBlocker => ({ code, path });

describe("blockerFlags", () => {
  it("marks the block, its lesson and its module by id", () => {
    const flags = blockerFlags(course, [blocker("way21.week-1.day-1.blocks[1]"), blocker("way21.week-1.day-1")]);
    expect([...flags.blocks]).toEqual(["b2"]);
    expect(flags.lessons.get("l1")).toBe(2);
    expect(flags.lessons.has("l2")).toBe(false);
    expect(flags.modules.get("m1")).toBe(2);
  });

  it("keeps course-level codes for the fields that answer them", () => {
    const flags = blockerFlags(course, [blocker("way21", "lms_ready_missing_tagline")]);
    expect(flags.courseCodes.has("lms_ready_missing_tagline")).toBe(true);
    expect(flags.lessons.size).toBe(0);
  });

  it("ignores a blocker whose lesson is gone", () => {
    const flags = blockerFlags(course, [blocker("way21.week-1.day-9")]);
    expect(flags.lessons.size + flags.modules.size + flags.blocks.size).toBe(0);
  });
});
