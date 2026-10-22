import { describe, expect, it } from "vitest";

import { assertCanEnable, AutoreplyError, rulePatch } from "./rules";

describe("rulePatch", () => {
  it("cleans words, texts and the link, and keeps the rule off unless told otherwise", () => {
    expect(
      rulePatch({
        name: "  ДОША ",
        keywords: ["Доша!", "доша", "DOSHA"],
        dmTexts: [" Привіт ", "", "Ще один"],
        publicReplies: ["a", "b", "c", "d", "e", "f", "g"],
        buttonUrl: "/tests/dosha",
        enabled: "yes",
        maxPerHour: 99999,
      }),
    ).toEqual({
      name: "ДОША",
      keywords: ["доша", "dosha"],
      dm_texts: ["Привіт", "Ще один"],
      public_replies: ["a", "b", "c", "d", "e"],
      button_url: "/tests/dosha",
      enabled: false,
      max_per_hour: 750,
    });
  });

  it("writes only the keys that are present", () => {
    expect(rulePatch({ enabled: true })).toEqual({ enabled: true });
  });

  it("refuses a link to another scheme or a protocol-relative address", () => {
    expect(rulePatch({ buttonUrl: "javascript:alert(1)" })).toEqual({ button_url: null });
    expect(rulePatch({ buttonUrl: "//evil.example" })).toEqual({ button_url: null });
    expect(rulePatch({ buttonUrl: "http://example.com" })).toEqual({ button_url: null });
    expect(rulePatch({ buttonUrl: "https://example.com/x" })).toEqual({ button_url: "https://example.com/x" });
  });
});

describe("assertCanEnable", () => {
  it("needs a word and a message", () => {
    expect(() => assertCanEnable({ keywords: [], dm_texts: ["a"] })).toThrow(AutoreplyError);
    expect(() => assertCanEnable({ keywords: ["a"], dm_texts: [] })).toThrow(AutoreplyError);
    expect(() => assertCanEnable({ keywords: ["a"], dm_texts: ["a"] })).not.toThrow();
  });
});
