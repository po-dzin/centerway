import { describe, expect, it } from "vitest";

import { planSweep, type MediaAsset } from "./mediaSweep";

const NOW = Date.parse("2026-08-28T12:00:00Z");
const daysAgo = (days: number) => new Date(NOW - days * 86_400_000).toISOString();

function asset(assetKey: string, newest: string, bytes = 1000): MediaAsset {
  return { assetKey, objects: [`${assetKey}/1600.webp`], bytes, newest };
}

const plan = (assets: MediaAsset[], referenced: string[], graceDays = 7) =>
  planSweep({ assets, referenced, graceDays, now: NOW });

describe("planSweep", () => {
  it("collects what nothing points at once it is past the grace period", () => {
    const result = plan(
      [asset("courses/c/old", daysAgo(30)), asset("courses/c/live", daysAgo(30))],
      ["courses/c/live"],
    );
    expect(result.collectable.map((a) => a.assetKey)).toEqual(["courses/c/old"]);
    expect(result.collectableBytes).toBe(1000);
  });

  it("leaves a just-uploaded image alone — it is not yet saved, not orphaned", () => {
    const result = plan([asset("courses/c/fresh", daysAgo(1)), asset("courses/c/kept", daysAgo(9))], ["courses/c/kept"]);
    expect(result.collectable).toHaveLength(0);
    expect(result.young.map((a) => a.assetKey)).toEqual(["courses/c/fresh"]);
  });

  it("keeps an image only version history still names", () => {
    // The caller's reference set already unions live content and revisions;
    // this is the guarantee that a restore is never a broken page.
    const result = plan([asset("courses/c/historic", daysAgo(400))], ["courses/c/historic"]);
    expect(result.collectable).toHaveLength(0);
    expect(result.referenced).toHaveLength(1);
  });

  it("refuses the whole run when the reference scan comes back empty", () => {
    // The dangerous shape: a full bucket, nothing referenced. That reads as a
    // broken reference query far more often than as a product with no saved
    // content, and the two are indistinguishable from here — so it stops.
    const result = plan([asset("courses/c/a", daysAgo(30)), asset("courses/c/b", daysAgo(30))], []);
    expect(result.refusal).toContain("refusing");
    expect(result.collectable).toHaveLength(0);
    expect(result.collectableBytes).toBe(0);
    // The report is still honest about what it saw.
    expect(result.totalBytes).toBe(2000);
  });

  it("has nothing to refuse about an empty bucket", () => {
    expect(planSweep({ assets: [], referenced: [], graceDays: 7, now: NOW }).refusal).toBeUndefined();
  });

  it("keeps a file whose timestamp cannot be read", () => {
    const result = plan([asset("courses/c/broken", "not a date"), asset("courses/c/live", daysAgo(1))], ["courses/c/live"]);
    expect(result.collectable).toHaveLength(0);
    expect(result.young).toHaveLength(1);
  });

  it("counts the whole bucket, not just what it would remove", () => {
    const result = plan(
      [asset("courses/c/keep", daysAgo(30), 5000), asset("courses/c/drop", daysAgo(30), 2000)],
      ["courses/c/keep"],
    );
    expect(result.totalBytes).toBe(7000);
    expect(result.collectableBytes).toBe(2000);
  });
});
