import { describe, expect, it } from "vitest";
import { NEW_WINDOW_DAYS, resolveHighlight } from "@/lib/experiences/highlight";

const now = new Date("2026-09-30T12:00:00Z");
const daysAgo = (days: number) => new Date(now.getTime() - days * 86_400_000).toISOString();

describe("resolveHighlight", () => {
  it("names a thing new for its first 30 days on the shelf", () => {
    expect(resolveHighlight({ first_listed_at: daysAgo(3) }, now)).toBe("new");
    expect(resolveHighlight({ first_listed_at: daysAgo(NEW_WINDOW_DAYS - 1) }, now)).toBe("new");
    expect(resolveHighlight({ first_listed_at: daysAgo(NEW_WINDOW_DAYS + 1) }, now)).toBeUndefined();
  });

  it("lets the owner's bestseller win over new", () => {
    expect(resolveHighlight({ highlight: "bestseller", first_listed_at: daysAgo(2) }, now)).toBe("bestseller");
  });

  it("prints nothing for a thing never listed, or a flag it does not know", () => {
    expect(resolveHighlight({ first_listed_at: null }, now)).toBeUndefined();
    expect(resolveHighlight({ highlight: "hot" }, now)).toBeUndefined();
    expect(resolveHighlight(null, now)).toBeUndefined();
  });

  it("does not call a date in the future new", () => {
    expect(resolveHighlight({ first_listed_at: daysAgo(-2) }, now)).toBeUndefined();
  });
});
