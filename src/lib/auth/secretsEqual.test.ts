import { describe, expect, it } from "vitest";

import { secretsEqual } from "./secretsEqual";

describe("secretsEqual", () => {
  it("accepts the expected secret", () => {
    expect(secretsEqual("Bearer s3cret", "Bearer s3cret")).toBe(true);
  });

  it("refuses a different, shorter or longer one", () => {
    expect(secretsEqual("Bearer s3creT", "Bearer s3cret")).toBe(false);
    expect(secretsEqual("Bearer s3cre", "Bearer s3cret")).toBe(false);
    expect(secretsEqual("Bearer s3cret!", "Bearer s3cret")).toBe(false);
  });

  it("refuses when either side is missing — an unset secret never matches an empty header", () => {
    expect(secretsEqual(null, "s3cret")).toBe(false);
    expect(secretsEqual("", "")).toBe(false);
    expect(secretsEqual("", undefined)).toBe(false);
  });
});
