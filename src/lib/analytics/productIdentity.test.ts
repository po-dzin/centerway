import { describe, expect, it } from "vitest";

import { buildProductIdentity } from "./productIdentity";

/**
 * The report's vocabulary, built from the same rows the checkout reads:
 * `offer_aliases`, `experience_offers`, `experiences`, `lms_courses`.
 */
const identity = buildProductIdentity({
  offers: [
    { id: "o-short", code: "course:short", experience_id: "exp-reboot" },
    { id: "o-irem", code: "course:irem-gymnastics", experience_id: "exp-irem" },
    { id: "o-way21", code: "course:way21", experience_id: "exp-way21" },
    { id: "o-group", code: "way21-group", experience_id: "exp-way21" },
    { id: "o-consult", code: "consult", experience_id: "exp-consult" },
  ],
  aliases: [
    { code: "short", offer_id: "o-short" },
    { code: "reboot", offer_id: "o-short" },
    { code: "irem", offer_id: "o-irem" },
    { code: "course:novyi-kurs-5", offer_id: "o-way21" },
  ],
  things: [
    { id: "exp-reboot", kind: "mini", title: null },
    { id: "exp-irem", kind: "course", title: null },
    { id: "exp-way21", kind: "course", title: null },
    { id: "exp-consult", kind: "consultation", title: "Консультація" },
  ],
  courses: [
    { slug: "short", title: "Short Reboot", experience_id: "exp-reboot", created_at: "2026-01-01" },
    { slug: "irem-gymnastics", title: "ІВЕМ-гімнастика", experience_id: "exp-irem", created_at: "2026-01-01" },
    { slug: "way21", title: "Шлях 21", experience_id: "exp-way21", created_at: "2026-01-01" },
  ],
});

describe("key", () => {
  it("folds every spelling of one course onto the same key", () => {
    // The bug this exists to prevent: Short Reboot standing in the product
    // breakdown twice, its revenue reported down either side of a naming
    // boundary that only exists in our own history.
    expect(identity.key("short")).toBe("course:short");
    expect(identity.key("reboot")).toBe("course:short");
    expect(identity.key("irem")).toBe("course:irem-gymnastics");
  });

  it("files a format under the course it delivers", () => {
    expect(identity.key("way21-group")).toBe("course:way21");
  });

  it("keeps a thing with no course under its own code", () => {
    expect(identity.key("consult")).toBe("consult");
  });

  it("follows an alias of a retired course code", () => {
    expect(identity.key("course:novyi-kurs-5")).toBe("course:way21");
  });

  it("keeps an unknown code visible as itself rather than folding it somewhere", () => {
    // Folding a code we do not understand into another product's row would
    // report one product's money under another's name.
    expect(identity.key("course:gone-course")).toBe("course:gone-course");
    expect(identity.key("course:Not-A-Slug")).toBe("course:Not-A-Slug");
    expect(identity.key("mystery")).toBe("mystery");
    for (const key of ["__proto__", "constructor", "toString"]) {
      expect(identity.key(key)).toBe(key);
    }
  });

  it("trims and ignores case, the way the checkout does", () => {
    expect(identity.key("  SHORT  ")).toBe("course:short");
  });

  it("takes a caller-chosen fallback for an empty code", () => {
    expect(identity.key(null)).toBe("unknown");
    expect(identity.key("   ")).toBe("unknown");
    expect(identity.key(undefined, "")).toBe("");
  });
});

describe("title", () => {
  it("names a course by its own title, whichever spelling asked", () => {
    expect(identity.title("short")).toBe("Short Reboot");
    expect(identity.title("course:short")).toBe("Short Reboot");
    expect(identity.title("way21-group")).toBe("Шлях 21");
  });

  it("names a thing with no course by its own title", () => {
    expect(identity.title("consult")).toBe("Консультація");
  });

  it("has nothing to say about an unknown code", () => {
    expect(identity.title("mystery")).toBeNull();
    expect(identity.title(null)).toBeNull();
  });
});
