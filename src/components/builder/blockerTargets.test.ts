import { describe, expect, it } from "vitest";

import type { Course, ReadinessBlocker } from "@/lms-core";
import { blockerTarget } from "./blockerTargets";

/**
 * The resolver between a blocker's address and a place the author can be sent.
 *
 * Worth testing on its own because both of its inputs drift independently:
 * `courseReadiness` owns the shape of the path, the builder owns the shape of
 * the route, and the arrow silently goes nowhere if either moves.
 */
const course = {
  slug: "way21",
  modules: [
    {
      slug: "week-1",
      lessons: [
        { slug: "day-1", title: "День 1", blocks: [{ id: "b1" }, { id: "b2" }] },
        { slug: "day-2", title: "День 2", blocks: [{ id: "b3" }] },
      ],
    },
  ],
} as unknown as Course;

const blocker = (path: string): ReadinessBlocker => ({ code: "lms_ready_placeholder", path });

describe("blockerTarget", () => {
  it("sends a course-level blocker to the course's own first screen", () => {
    expect(blockerTarget(course, blocker("way21"))?.href).toBe("/build/way21#course-overview");
  });

  it("opens the lesson a lesson-level blocker names", () => {
    expect(blockerTarget(course, blocker("way21.week-1.day-2"))?.href).toBe("/build/way21/day-2");
  });

  /** The index is resolved to the block's own id: an index moves, an id does not. */
  it("names the block by id, not by position", () => {
    expect(blockerTarget(course, blocker("way21.week-1.day-1.blocks[1]"))?.href).toBe(
      "/build/way21/day-1#block-b2"
    );
  });

  it("falls back to the lesson when the index is past the end", () => {
    expect(blockerTarget(course, blocker("way21.week-1.day-1.blocks[9]"))?.href).toBe("/build/way21/day-1");
  });

  it("resolves nothing for a lesson that is no longer in the course", () => {
    expect(blockerTarget(course, blocker("way21.week-1.day-9"))).toBeNull();
  });
});
