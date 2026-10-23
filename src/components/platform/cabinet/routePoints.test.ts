import { describe, expect, it } from "vitest";

import { routePoints } from "./CourseCard";

describe("course route", () => {
  it("lays one dot per lesson, turning back at the end of each row", () => {
    const { points } = routePoints(14, 10);
    expect(points).toHaveLength(14);
    // Row two runs right to left: its first dot stands under the last of row one.
    expect(points[10]?.x).toBeCloseTo(points[9]?.x ?? 0);
    expect(points[10]?.y).toBeGreaterThan(points[9]?.y ?? 0);
  });
});
