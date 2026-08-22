import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  LEARNING_PATH_PREFIX,
  PUBLIC_ROOT_SEGMENTS,
  canonicalPersonalPath,
  isPublicRootPath,
  personalRouteFor,
} from "./catalog";

/**
 * The list of public root segments is a ROUTER FACT, and a hand-kept copy of a
 * router fact drifts the first time somebody adds a page. On the personal host
 * an unclaimed path is a course, so a segment missing from the list would make
 * a public page look like a course that does not exist.
 */
describe("public root segments", () => {
  it("matches the platform router", () => {
    const dir = join(process.cwd(), "src/app/(platform)");
    const routed = readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      // The learner tree is the one directory that is NOT public: it is the
      // internal prefix the personal host rewrites onto.
      .filter((name) => `/${name}` !== LEARNING_PATH_PREFIX)
      .sort();

    expect(routed).toEqual([...PUBLIC_ROOT_SEGMENTS].sort());
  });

  it("matches by segment, not by string prefix", () => {
    expect(isPublicRootPath("/programs/way21")).toBe(true);
    expect(isPublicRootPath("/programmatic")).toBe(false);
    expect(isPublicRootPath("/")).toBe(false);
  });
});

describe("the personal address ↔ route pair", () => {
  it("drops the learner prefix from an address and puts it back for a route", () => {
    for (const [route, address] of [
      ["/learn", "/"],
      ["/learn/way21", "/way21"],
      ["/learn/way21/day-1", "/way21/day-1"],
    ] as const) {
      expect(canonicalPersonalPath(route), route).toBe(address);
      expect(personalRouteFor(address), address).toBe(route);
    }
  });

  it("leaves the builder's prefix alone in both directions", () => {
    // `/build` is a real segment on this host, not a container: `my/build` IS
    // the builder's home, so stripping it would point at the dashboard.
    expect(canonicalPersonalPath("/build/way21")).toBe("/build/way21");
    expect(personalRouteFor("/build/way21")).toBe("/build/way21");
  });

  it("carries the query and hash", () => {
    expect(canonicalPersonalPath("/learn?tab=done")).toBe("/?tab=done");
    expect(canonicalPersonalPath("/learn/way21#top")).toBe("/way21#top");
  });

  it("does not strip a prefix that is only a string match", () => {
    expect(canonicalPersonalPath("/learning-hub")).toBe("/learning-hub");
  });
});
