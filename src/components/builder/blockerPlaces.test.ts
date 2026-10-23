import { describe, expect, it } from "vitest";

import type { Course, ReadinessBlocker } from "@/lms-core";
import { blockerPlaces, placeOrder, stepPlace } from "./blockerPlaces";

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

describe("blockerPlaces", () => {
  it("walks the course in its own order and counts a place once", () => {
    const places = blockerPlaces(course, [
      blocker("way21.week-1.day-2.blocks[0]"),
      blocker("way21.week-1.day-1.blocks[1]"),
      blocker("way21.week-1.day-1.blocks[1]", "lms_ready_invalid_href"),
      blocker("way21"),
    ]);
    expect(places.map((place) => place.key)).toEqual([
      "way21",
      "way21.week-1.day-1.blocks[1]",
      "way21.week-1.day-2.blocks[0]",
    ]);
    expect(places[1]?.blockId).toBe("b2");
    expect(places[1]?.href).toBe("/build/way21/day-1#block-b2");
  });

  it("drops a report about a lesson that no longer exists", () => {
    expect(blockerPlaces(course, [blocker("way21.week-1.gone.blocks[0]")])).toEqual([]);
  });
});

describe("stepPlace", () => {
  const places = blockerPlaces(course, [
    blocker("way21.week-1.day-1.blocks[1]"),
    blocker("way21.week-1.day-2.blocks[0]"),
  ]);

  it("starts at the ends when the author is nowhere in particular", () => {
    expect(stepPlace(places, null, 1)?.place.blockId).toBe("b2");
    expect(stepPlace(places, null, -1)?.place.blockId).toBe("b3");
  });

  it("moves across lessons and wraps at the ends", () => {
    expect(stepPlace(places, placeOrder(0, 1), 1)).toMatchObject({ place: { blockId: "b3" }, wrapped: false });
    expect(stepPlace(places, placeOrder(1, 0), 1)).toMatchObject({ place: { blockId: "b2" }, wrapped: true });
    expect(stepPlace(places, placeOrder(0, 1), -1)).toMatchObject({ place: { blockId: "b3" }, wrapped: true });
  });

  it("is empty-safe", () => {
    expect(stepPlace([], null, 1)).toBeNull();
  });
});
