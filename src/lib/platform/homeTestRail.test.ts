import { describe, expect, it } from "vitest";
import { homeTestRail, platformTests, type PlatformTestEntry } from "@/lib/platform/tests";

const active = (n: number): PlatformTestEntry[] =>
  Array.from({ length: n }, (_, i) => ({
    ...platformTests[0]!,
    slug: `t${i}`,
    href: `/tests/t${i}`,
    status: "active" as const,
  }));

describe("homeTestRail", () => {
  it("shows up to two tests as picture rows", () => {
    expect(homeTestRail(active(2))).toMatchObject({ density: "picture", total: 2 });
    expect(homeTestRail(active(2)).rows).toHaveLength(2);
  });

  it("shows three tests as compact rows", () => {
    const rail = homeTestRail(active(3));
    expect(rail).toMatchObject({ density: "compact", total: 3 });
    expect(rail.rows).toHaveLength(3);
  });

  it("shows the first two of four and more, and counts them all", () => {
    const rail = homeTestRail(active(5));
    expect(rail).toMatchObject({ density: "picture", total: 5 });
    expect(rail.rows.map((t) => t.slug)).toEqual(["t0", "t1"]);
  });

  it("never lists a planned test or one without a surface", () => {
    const tests = [...active(1), { ...platformTests[0]!, slug: "p", status: "planned" as const, href: null }];
    expect(homeTestRail(tests).total).toBe(1);
  });
});
