import { describe, expect, it } from "vitest";

import { accessStateOf, isAccessOpen } from "./access";

describe("a seat with a start date", () => {
  const now = new Date("2026-11-15T12:00:00Z");

  it("stays shut before its start and opens at it", () => {
    expect(accessStateOf({ status: "active", startsAt: "2026-12-01T00:00:00Z" }, now)).toBe("scheduled");
    expect(isAccessOpen({ status: "active", startsAt: "2026-12-01T00:00:00Z" }, now)).toBe(false);
    expect(accessStateOf({ status: "active", startsAt: "2026-11-01T00:00:00Z" }, now)).toBe("active");
    expect(accessStateOf({ status: "active", startsAt: null }, now)).toBe("active");
  });

  it("lets a ban or a revoke speak first", () => {
    expect(accessStateOf({ blockedAt: "2026-11-01T00:00:00Z", startsAt: "2026-12-01T00:00:00Z" }, now)).toBe("blocked");
    expect(accessStateOf({ status: "revoked", startsAt: "2026-12-01T00:00:00Z" }, now)).toBe("revoked");
  });
});
