import { describe, expect, it } from "vitest";

import { formatFloor } from "./formatFloor";
import type { ProgramFormat } from "./formats";

function format(overrides: Partial<ProgramFormat> & Pick<ProgramFormat, "code">): ProgramFormat {
  return {
    format: "self",
    label: "Самостійно",
    summary: "",
    features: [],
    mode: "checkout",
    amount: 4100,
    listAmount: null,
    currency: "UAH",
    cohortStartsOn: null,
    includes: [],
    ...overrides,
  } as ProgramFormat;
}

describe("formatFloor", () => {
  it("quotes the cheapest priced format, an enquiry included", () => {
    expect(
      formatFloor([
        format({ code: "course:way21", mode: "lead", amount: 3900 }),
        format({ code: "way21-group", format: "group", amount: 4100 }),
        format({ code: "way21-support", format: "individual", mode: "lead", amount: 9000 }),
      ]),
    ).toEqual({ amount: 3900, currency: "UAH" });
  });

  it("follows the base format when its price changes", () => {
    const group = format({ code: "way21-group", format: "group", amount: 4100 });
    expect(formatFloor([format({ code: "course:way21", amount: 4100 }), group])?.amount).toBe(4100);
    expect(formatFloor([format({ code: "course:way21", amount: 3500 }), group])?.amount).toBe(3500);
  });

  it("skips formats with no price, and says nothing for a single format or none priced", () => {
    expect(
      formatFloor([format({ code: "a", amount: null, mode: "lead" }), format({ code: "b", amount: 2000 })])?.amount,
    ).toBe(2000);
    expect(formatFloor([format({ code: "a" })])).toBeNull();
    expect(formatFloor([format({ code: "a", amount: null }), format({ code: "b", amount: null })])).toBeNull();
  });
});
