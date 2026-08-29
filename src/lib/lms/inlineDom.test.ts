import { describe, expect, it } from "vitest";

import type { InlineText } from "@/lms-core";
import { inlineToHtml, inlineToNodes, nodesToInline, type MarkupNode } from "./inlineDom";

const text = (value: string): MarkupNode => ({ kind: "text", text: value });
const el = (tag: string, children: MarkupNode[], href?: string): MarkupNode => ({
  kind: "element",
  tag,
  ...(href ? { href } : {}),
  children,
});

describe("nodesToInline", () => {
  it("returns a bare string when nothing is marked up", () => {
    // The rule that keeps an untouched lesson's diff empty: a third of the
    // inline values in the shipped courses are plain strings.
    expect(nodesToInline([text("проста фраза")])).toBe("проста фраза");
  });

  it("emits only the keys that are set", () => {
    expect(nodesToInline([el("b", [text("жирне")])])).toEqual([{ text: "жирне", bold: true }]);
  });

  it("reads both tag spellings a browser may produce", () => {
    expect(nodesToInline([el("strong", [text("a")]), el("em", [text("b")])])).toEqual([
      { text: "a", bold: true },
      { text: "b", italic: true },
    ]);
  });

  it("nests bold inside a link", () => {
    expect(nodesToInline([el("a", [el("b", [text("тиць")])], "/pay")])).toEqual([
      { text: "тиць", bold: true, href: "/pay" },
    ]);
  });

  it("ignores an <a> that has no target", () => {
    // Half-applied links exist mid-edit; a span with href: "" fails validation.
    expect(nodesToInline([el("a", [text("ще не посилання")])])).toBe("ще не посилання");
  });

  it("coalesces neighbours that carry the same formatting", () => {
    // Without this a keystroke inside a word leaves a seam in the stored value.
    expect(nodesToInline([text("одне "), text("ціле")])).toBe("одне ціле");
  });

  it("turns a line break into a space rather than dropping it", () => {
    expect(nodesToInline([text("рядок"), el("br", []), text("далі")])).toBe("рядок далі");
  });

  it("reads an emptied editor as empty, which the caller deletes", () => {
    expect(nodesToInline([])).toBe("");
    expect(nodesToInline([el("br", [])])).toBe(" ");
  });
});

describe("round trip", () => {
  const values: InlineText[] = [
    "проста фраза",
    [{ text: "звичайний " }, { text: "жирний", bold: true }, { text: " і далі" }],
    [{ text: "курсив", italic: true }],
    [{ text: "лінк", href: "https://centerway.net.ua" }],
    [{ text: "жирний лінк", bold: true, href: "/pay" }],
    [{ text: "а", bold: true, italic: true, href: "/x" }],
  ];

  it("survives spans → nodes → spans unchanged", () => {
    for (const value of values) {
      expect(nodesToInline(inlineToNodes(value))).toEqual(value);
    }
  });
});

describe("inlineToHtml", () => {
  it("escapes authored text instead of trusting it", () => {
    expect(inlineToHtml("<script>alert(1)</script>")).toBe("&lt;script&gt;alert(1)&lt;/script&gt;");
  });

  it("escapes the href too", () => {
    expect(inlineToHtml([{ text: "x", href: '/a"onmouseover="' }])).toContain("&quot;");
  });

  it("writes bold inside italic inside link, the same order as the text dialect", () => {
    expect(inlineToHtml([{ text: "x", bold: true, italic: true, href: "/p" }])).toBe(
      '<a href="/p"><i><b>x</b></i></a>'
    );
  });
});
