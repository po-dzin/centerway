import { describe, expect, it } from "vitest";

import { inlineToMarkup, markupToInline } from "./inlineMarkup";
import { listCourses } from "./catalog";
import { validateInlineText, type InlineText } from "@/lms-core";

function roundTrip(value: InlineText): InlineText {
  return markupToInline(inlineToMarkup(value));
}

describe("inline markup", () => {
  it("leaves a plain string a plain string", () => {
    expect(roundTrip("Просто текст")).toBe("Просто текст");
  });

  it("collapses an unstyled span list to a string", () => {
    // Not a loss: one unstyled span and the bare string are the same value in
    // the model, and the string is the authoring shorthand.
    expect(roundTrip([{ text: "Один спан" }])).toBe("Один спан");
  });

  it("round-trips bold, italic and links", () => {
    const value: InlineText = [
      { text: "Варіант 1. ", bold: true },
      { text: "звичайний" },
      { text: " курсив", italic: true },
      { text: " посилання", href: "https://example.com" },
    ];
    expect(roundTrip(value)).toEqual(value);
  });

  it("round-trips a span carrying more than one mark", () => {
    const value: InlineText = [{ text: "жирне посилання", bold: true, href: "https://example.com" }];
    expect(roundTrip(value)).toEqual(value);
  });

  it("keeps literal markup characters literal", () => {
    // The escape is what stops "2 * 2" from turning into an italic run and
    // eating the rest of the paragraph.
    const value = "2 * 2 [не посилання] \\ кінець";
    expect(roundTrip(value)).toBe(value);
  });

  it("treats an unclosed bracket as text", () => {
    expect(roundTrip("[не закрито")).toBe("[не закрито");
  });

  it("renders the expected dialect", () => {
    expect(inlineToMarkup([{ text: "жирне", bold: true }, { text: " і ", }, { text: "лінк", href: "/learn" }])).toBe(
      "**жирне** і [лінк](/learn)"
    );
  });

  /**
   * The real assurance. If a round trip through the editor changed ANY inline
   * value in the shipped courses, an author who opened a lesson and pressed
   * save would rewrite content they never touched.
   */
  it("round-trips every inline value in every shipped course", () => {
    let checked = 0;

    const visit = (value: unknown) => {
      if (Array.isArray(value)) {
        if (value.length > 0 && value.every((item) => isSpan(item))) {
          const original = value as InlineText;
          const result = roundTrip(original);
          validateInlineText(result, "roundtrip");
          expect(result).toEqual(original);
          checked += 1;
          return;
        }
        value.forEach(visit);
        return;
      }
      if (value && typeof value === "object") {
        Object.values(value as Record<string, unknown>).forEach(visit);
      }
    };

    for (const course of listCourses()) visit(course);
    expect(checked).toBeGreaterThan(50);
  });
});

/* A string `text` is not enough to identify a span: rich-text nodes carry
   `{kind, text}` and checklist items carry `{id, text}`, and mistaking either
   for a span list flattened a whole document into one line. A span's keys are
   exactly this closed set, so membership is the test. */
const SPAN_KEYS = new Set(["text", "bold", "italic", "href"]);

function isSpan(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  if (typeof record.text !== "string") return false;
  return Object.keys(record).every((key) => SPAN_KEYS.has(key));
}
