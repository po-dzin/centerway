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

describe("hostile and malformed product codes", () => {
  it("does not walk the prototype chain looking for a course", () => {
    // `PRODUCTS[code]` is an index by a string that reaches here from a query
    // parameter on the payment route. `__proto__` and `constructor` resolve to
    // real objects on any plain object literal, and had this read `.fulfilment`
    // off one of them without checking `kind`, a crafted code could have
    // steered fulfilment. It checks, so they resolve to no course at all.
    for (const key of ["__proto__", "constructor", "toString", "hasOwnProperty", "valueOf"]) {
      expect(productCourseSlug(key)).toBeNull();
      expect(canonicalProductKey(key)).toBe(key);
    }
  });

  it("rejects a course code whose slug is not slug-shaped", () => {
    // `parseCourseOfferCode` shape-checks because the slug becomes a database
    // lookup; a code that merely starts with the prefix is not a course.
    expect(productCourseSlug("course:")).toBeNull();
    expect(productCourseSlug("course:Not-A-Slug")).toBeNull();
    expect(productCourseSlug("course:has spaces")).toBeNull();
    expect(productCourseSlug("course:trailing-")).toBeNull();
    expect(productCourseSlug("course:../etc/passwd")).toBeNull();
    expect(productCourseSlug("course:a%27--")).toBeNull();
  });

  it("keeps an unparseable code as itself instead of folding it somewhere", () => {
    // Folding a code we do not understand into another product's row would
    // report one product's money under another's name.
    expect(canonicalProductKey("course:Not-A-Slug")).toBe("course:Not-A-Slug");
  });

  it("trims, because a stored code with whitespace is the same product", () => {
    expect(productCourseSlug("  short  ")).toBe("short");
    expect(canonicalProductKey("  course:short  ")).toBe("course:short");
  });

  it("is case-sensitive, because slugs are", () => {
    // `SHORT` is not `short`: quietly accepting it would let two spellings
    // resolve to one course through a rule nothing else in the system follows.
    expect(productCourseSlug("SHORT")).toBeNull();
  });

  it("takes a caller-chosen fallback for an empty code", () => {
    expect(canonicalProductKey(undefined, "")).toBe("");
    expect(canonicalProductKey(null, "n/a")).toBe("n/a");
  });
});
