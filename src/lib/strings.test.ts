import { describe, expect, it } from "vitest";

import { emailIlike, sameEmail } from "./strings";

describe("emailIlike", () => {
  /* The bug it exists for: `_` is "any one character" to LIKE, so the owner of
     ivan_petrov@x matched the customer row of ivan.petrov@x (meta-audit
     2026-09-30). */
  it("escapes the LIKE wildcards and the escape character", () => {
    expect(emailIlike("ivan_petrov@x.com")).toBe("ivan\\_petrov@x.com");
    expect(emailIlike("100%@x.com")).toBe("100\\%@x.com");
    expect(emailIlike("a\\b@x.com")).toBe("a\\\\b@x.com");
  });

  it("trims and lower-cases, as the stored addresses are compared", () => {
    expect(emailIlike("  Buyer@Example.COM ")).toBe("buyer@example.com");
  });
});

describe("sameEmail", () => {
  it("ignores case and surrounding space", () => {
    expect(sameEmail(" Buyer@Example.com", "buyer@example.com ")).toBe(true);
  });

  it("does not treat a near-miss as the same mailbox", () => {
    expect(sameEmail("ivan.petrov@x.com", "ivan_petrov@x.com")).toBe(false);
    expect(sameEmail("a*b@x.com", "ab@x.com")).toBe(false);
  });

  it("never matches an empty or missing address", () => {
    expect(sameEmail("", "")).toBe(false);
    expect(sameEmail(null, "a@x.com")).toBe(false);
    expect(sameEmail("a@x.com", undefined)).toBe(false);
  });
});
