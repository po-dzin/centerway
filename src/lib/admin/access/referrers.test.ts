import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/adminClient", () => ({ adminClient: () => null }));

import { tagFromEmail } from "./referrers";

describe("a referrer's tag", () => {
  it("is the address's local part in the tag's shape", () => {
    expect(tagFromEmail("Olena@example.com")).toBe("olena");
    expect(tagFromEmail("Olena.K+cw@gmail.com")).toBe("olena-k-cw");
    expect(tagFromEmail("__x__@b.co")).toBe("x");
  });

  it("never comes back empty or out of shape", () => {
    expect(tagFromEmail("...@b.co")).toBe("friend");
    expect(tagFromEmail(`${"a".repeat(80)}@b.co`)).toHaveLength(56);
  });
});
