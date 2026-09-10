import { describe, expect, it } from "vitest";
import { canonicalProductKey, productCourseSlug } from "./productIdentity";

describe("productCourseSlug", () => {
  it("reads the slug out of a builder offer code", () => {
    expect(productCourseSlug("course:natural-body")).toBe("natural-body");
  });

  it("resolves a legacy landing code through the checkout's own fulfilment", () => {
    // `irem` is the only product whose landing code and course slug differ in
    // both directions, which is exactly the case a hand-written map gets wrong.
    expect(productCourseSlug("irem")).toBe("irem-gymnastics");
    expect(productCourseSlug("short")).toBe("short");
  });

  it("returns null for a code that delivers no course", () => {
    expect(productCourseSlug("consult")).toBeNull();
    expect(productCourseSlug("")).toBeNull();
    expect(productCourseSlug(null)).toBeNull();
  });
});

describe("canonicalProductKey", () => {
  it("folds both spellings of one course onto the same key", () => {
    // The bug this exists to prevent: Short Reboot standing in the product
    // breakdown twice, its revenue reported down either side of a naming
    // boundary that only exists in our own history.
    expect(canonicalProductKey("short")).toBe(canonicalProductKey("course:short"));
    expect(canonicalProductKey("irem")).toBe(canonicalProductKey("course:irem-gymnastics"));
  });

  it("keeps a non-course code as itself", () => {
    expect(canonicalProductKey("consult")).toBe("consult");
  });

  it("keeps an unrecognised course code visible rather than hiding it", () => {
    // A course row that no longer exists must read as its own code, never as
    // an "unknown product" indistinguishable from a title that failed to load.
    expect(canonicalProductKey("course:novyi-kurs-5")).toBe("course:novyi-kurs-5");
  });

  it("falls back only when there is nothing to key on", () => {
    expect(canonicalProductKey(null)).toBe("unknown");
    expect(canonicalProductKey("   ")).toBe("unknown");
  });
});
