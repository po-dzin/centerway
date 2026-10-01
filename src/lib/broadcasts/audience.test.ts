import { describe, expect, it } from "vitest";

import { parseAudience } from "./audience";

describe("parseAudience", () => {
  it("keeps known rules and cleans their lists", () => {
    expect(
      parseAudience({
        include: [
          { kind: "buyers", product_codes: [" short ", "short", 3, ""] },
          { kind: "registered", opted_in_only: "yes" },
        ],
        exclude_tags: ["test_completed"],
        exclude_buyers: ["way21-group", "way21-group"],
      }),
    ).toEqual({
      include: [
        { kind: "buyers", product_codes: ["short"] },
        { kind: "registered", opted_in_only: false },
      ],
      exclude_tags: ["test_completed"],
      exclude_buyers: ["way21-group"],
    });
  });

  it("refuses an unknown kind instead of storing a rule that matches nobody", () => {
    expect(parseAudience({ include: [{ kind: "everyone" }] })).toBeNull();
    expect(parseAudience({ include: "buyers" })).toBeNull();
    expect(parseAudience(null)).toBeNull();
  });

  it("drops a tag rule with no tags and a rule given twice", () => {
    expect(
      parseAudience({
        include: [{ kind: "tag", tags: [] }, { kind: "leads" }, { kind: "leads", product_codes: [] }],
      }),
    ).toEqual({ include: [{ kind: "leads", product_codes: [] }], exclude_tags: [], exclude_buyers: [] });
  });
});
