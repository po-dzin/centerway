import { describe, expect, it } from "vitest";

import {
  anchorsOverlap,
  annotationLabel,
  clampNote,
  clampPrefix,
  clampQuote,
  normalizeAnnotationText,
  resolveAnchor,
  sortAnnotations,
  type Annotation,
  type AnnotationAnchor,
} from "./annotations";

const TEXT = "Чорний чай і кава виходять першими. Потім цукор і біле борошно. Чорний чай повертається аж наприкінці.";

function anchor(overrides: Partial<AnnotationAnchor> = {}): AnnotationAnchor {
  return { blockId: "b1", start: 0, end: 17, quote: "Чорний чай і кава", prefix: "", ...overrides };
}

function mark(overrides: Partial<Annotation> = {}): Annotation {
  return {
    clientId: "c1",
    kind: "highlight",
    lessonSlug: "w1-nutrition",
    anchor: anchor(),
    note: null,
    courseVersion: 1,
    createdAt: "2026-08-28T00:00:00Z",
    updatedAt: "2026-08-28T00:00:00Z",
    ...overrides,
  };
}

describe("normalizeAnnotationText", () => {
  it("collapses the whitespace the DOM happens to carry", () => {
    expect(normalizeAnnotationText("  Чорний\n  чай  ")).toBe("Чорний чай");
  });
});

describe("clamps", () => {
  it("keeps the END of the prefix — it is the run touching the quote", () => {
    expect(clampPrefix("a".repeat(60) + "кінець")).toHaveLength(40);
    expect(clampPrefix("a".repeat(60) + "кінець").endsWith("кінець")).toBe(true);
  });

  it("caps the quote and the note", () => {
    expect(clampQuote("я".repeat(900))).toHaveLength(600);
    expect(clampNote(" " + "я".repeat(3000))).toHaveLength(2000);
  });
});

describe("resolveAnchor", () => {
  it("trusts the offsets when the text there still reads as the quote", () => {
    expect(resolveAnchor(TEXT, anchor())).toEqual({ found: true, start: 0, end: 17, moved: false });
  });

  it("re-finds the passage after an edit above it", () => {
    const edited = "Спершу коротко. " + TEXT;
    const result = resolveAnchor(edited, anchor());
    expect(result).toMatchObject({ found: true, moved: true });
    if (result.found) expect(edited.slice(result.start, result.end)).toBe("Чорний чай і кава");
  });

  it("uses the prefix to pick between two identical phrases", () => {
    // Stale offsets on purpose: the passage moved, and only the prefix says
    // which of the two «Чорний чай» is the marked one.
    const result = resolveAnchor(TEXT, anchor({ quote: "Чорний чай", start: 200, end: 210, prefix: "біле борошно. " }));
    expect(result).toMatchObject({ found: true, moved: true });
    if (result.found) expect(result.start).toBe(TEXT.indexOf("біле борошно. ") + "біле борошно. ".length);
  });

  it("without a prefix takes the occurrence nearest to where the mark was", () => {
    const late = TEXT.lastIndexOf("Чорний чай");
    const result = resolveAnchor(TEXT, anchor({ quote: "Чорний чай", start: late + 2, end: late + 12 }));
    expect(result).toMatchObject({ found: true, start: late, moved: true });
  });

  it("reports a mark whose passage is gone rather than guessing", () => {
    expect(resolveAnchor("Зовсім інший абзац.", anchor())).toEqual({ found: false });
  });
});

describe("sortAnnotations", () => {
  it("reads in document order, bookmarks first, detached marks last", () => {
    const order = ["b1", "b2"];
    const sorted = sortAnnotations(
      [
        mark({ clientId: "late", anchor: anchor({ blockId: "b2", start: 5, end: 9 }) }),
        mark({ clientId: "gone", anchor: anchor({ blockId: "removed", start: 0, end: 4 }) }),
        mark({ clientId: "early", anchor: anchor({ blockId: "b1", start: 40, end: 44 }) }),
        mark({ clientId: "book", kind: "bookmark", anchor: null }),
      ],
      order
    );
    expect(sorted.map((a) => a.clientId)).toEqual(["book", "early", "late", "gone"]);
  });
});

describe("anchorsOverlap", () => {
  it("is true for two marks that touch in the same block", () => {
    expect(anchorsOverlap(anchor(), anchor({ start: 10, end: 30 }))).toBe(true);
  });

  it("is false across blocks and for neighbours that only meet at an edge", () => {
    expect(anchorsOverlap(anchor(), anchor({ blockId: "b2", start: 0, end: 17 }))).toBe(false);
    expect(anchorsOverlap(anchor(), anchor({ start: 17, end: 30 }))).toBe(false);
  });
});

describe("annotationLabel", () => {
  it("prefers the reader's own words to the quote", () => {
    expect(annotationLabel(mark({ note: "спитати про каву" }))).toBe("спитати про каву");
    expect(annotationLabel(mark())).toBe("Чорний чай і кава");
  });
});
