import { describe, expect, it } from "vitest";

import { staysInCourse } from "./useBuilderExit";

/**
 * The one decision the exit rule makes, tested where it is made.
 *
 * Everything else in `useBuilderExit` is React state around a router; this
 * predicate is what decides whether an author is asked a question or moved
 * silently, and getting it wrong is invisible in both directions — a missing
 * prompt loses work, a spurious one interrupts every second click.
 */
describe("staysInCourse", () => {
  it("keeps every depth of the course inside it", () => {
    expect(staysInCourse("/build/way21", "way21")).toBe(true);
    expect(staysInCourse("/build/way21/day-1", "way21")).toBe(true);
    expect(staysInCourse("/build/way21#course-release", "way21")).toBe(true);
    expect(staysInCourse("/build/way21/day-1?zen=1", "way21")).toBe(true);
  });

  it("treats the overview, the shelf and another course as leaving", () => {
    expect(staysInCourse("/build", "way21")).toBe(false);
    /* `/build/courses` is the materials shelf, not a course — the reserved
       slug that makes the static route safe also has to read as "outside" to
       the exit guard, or an unsaved lesson would leave without asking. */
    expect(staysInCourse("/build/courses", "way21")).toBe(false);
    expect(staysInCourse("/build/other", "way21")).toBe(false);
  });

  it("treats anything outside the builder as leaving", () => {
    expect(staysInCourse("/learn/way21", "way21")).toBe(false);
    expect(staysInCourse("/profile", "way21")).toBe(false);
    expect(staysInCourse("/", "way21")).toBe(false);
  });

  /** Slugs travel encoded in hrefs and decoded in props. */
  it("compares the slug decoded", () => {
    expect(staysInCourse("/build/%D1%88%D0%BB%D1%8F%D1%85-21/day-1", "шлях-21")).toBe(true);
  });
});
