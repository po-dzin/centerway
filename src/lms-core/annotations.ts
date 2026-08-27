/**
 * CenterWay LMS core — the reader's own marks.
 *
 * PURE TS. No DOM, no React, no Next, no npm deps.
 *
 * A bookmark says «this lesson»; a highlight says «this passage»; a highlight
 * carrying `note` is the margin note. Three names, two shapes, one table.
 *
 * THE HARD PART IS THE ANCHOR, and it is here rather than in the player because
 * a native reader will have to re-find the same passage with the same rules.
 * A highlight is stored as offsets into the block's rendered plain text, plus
 * the text it was made from (`quote`) and what stood before it (`prefix`).
 * Offsets alone are a promise the content cannot keep — the author edits the
 * paragraph and every mark after the edit slides. So the offsets are a HINT
 * that is verified against the quote, and the quote is what actually finds the
 * passage. When neither works the mark is not deleted; it becomes DETACHED and
 * is still listed with its text, because a reader's note disappearing because
 * someone else edited a sentence is the one outcome this must never produce.
 */

export type AnnotationKind = "bookmark" | "highlight";

export type AnnotationAnchor = {
  /** `LessonBlock.id` — the paragraph, step or list the mark lives in. */
  blockId: string;
  start: number;
  end: number;
  /** The marked text itself, as it read when the mark was made. */
  quote: string;
  /** The run before the quote, so a repeated phrase resolves to the right one. */
  prefix: string;
};

export type Annotation = {
  /** Client-generated; the reader's device names the mark before the server answers. */
  clientId: string;
  kind: AnnotationKind;
  lessonSlug: string;
  anchor: AnnotationAnchor | null;
  note: string | null;
  /** `lms_courses.version` the offsets were measured against. */
  courseVersion: number;
  createdAt: string;
  updatedAt: string;
};

/** A quote long enough to re-find a passage, short enough not to be the lesson. */
export const ANNOTATION_QUOTE_MAX = 600;
export const ANNOTATION_PREFIX_MAX = 40;
export const ANNOTATION_NOTE_MAX = 2000;

/**
 * One space, always.
 *
 * The DOM hands back the text with whatever whitespace the markup happened to
 * carry, and the same passage read on two renders can differ by a newline. A
 * quote that is compared literally would then fail to match itself.
 */
export function normalizeAnnotationText(value: string): string {
  return value.replace(/\s+/gu, " ").trim();
}

export function clampQuote(value: string): string {
  return normalizeAnnotationText(value).slice(0, ANNOTATION_QUOTE_MAX);
}

export function clampPrefix(value: string): string {
  const normalized = normalizeAnnotationText(value);
  return normalized.slice(Math.max(0, normalized.length - ANNOTATION_PREFIX_MAX));
}

export function clampNote(value: string): string {
  return value.trim().slice(0, ANNOTATION_NOTE_MAX);
}

export type AnchorResolution =
  | { found: true; start: number; end: number; moved: boolean }
  | { found: false };

/**
 * Where the mark sits in the block's text NOW.
 *
 * Three attempts, in falling order of confidence:
 *   1. the stored offsets, if the text there still reads as the quote;
 *   2. the prefix + quote together, which disambiguates a phrase that repeats;
 *   3. the occurrence of the quote nearest to where it used to be.
 * `moved` reports that the answer came from 2 or 3 — the mark survived an edit
 * and its offsets want rewriting.
 */
export function resolveAnchor(text: string, anchor: AnnotationAnchor): AnchorResolution {
  const quote = anchor.quote;
  if (!quote) return { found: false };

  if (text.slice(anchor.start, anchor.end) === quote) {
    return { found: true, start: anchor.start, end: anchor.end, moved: false };
  }

  if (anchor.prefix) {
    const withPrefix = text.indexOf(anchor.prefix + quote);
    if (withPrefix >= 0) {
      const start = withPrefix + anchor.prefix.length;
      return { found: true, start, end: start + quote.length, moved: true };
    }
  }

  // Every occurrence, and the one closest to where the mark used to be wins:
  // an edit above the passage shifts it, it does not move it to another
  // paragraph, so distance is the honest tie-breaker.
  let best = -1;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let at = text.indexOf(quote); at >= 0; at = text.indexOf(quote, at + 1)) {
    const distance = Math.abs(at - anchor.start);
    if (distance < bestDistance) {
      best = at;
      bestDistance = distance;
    }
  }
  if (best >= 0) return { found: true, start: best, end: best + quote.length, moved: true };

  return { found: false };
}

/**
 * Reading order for a lesson's marks.
 *
 * By block position first, then by offset — the order the reader met them,
 * which is the only order a notes list can be read in. Blocks the lesson no
 * longer contains sort last: they are the detached ones, and they belong after
 * everything still standing rather than scattered through it.
 */
export function sortAnnotations(annotations: Annotation[], blockOrder: string[]): Annotation[] {
  const position = new Map(blockOrder.map((id, index) => [id, index]));
  const rank = (annotation: Annotation): number => {
    if (!annotation.anchor) return -1; // a bookmark belongs to the lesson, so it leads
    return position.get(annotation.anchor.blockId) ?? Number.MAX_SAFE_INTEGER;
  };
  return [...annotations].sort((a, b) => {
    const byBlock = rank(a) - rank(b);
    if (byBlock !== 0) return byBlock;
    return (a.anchor?.start ?? 0) - (b.anchor?.start ?? 0);
  });
}

/** Overlap, in the block's own coordinates. Used to fold a re-mark into the mark it touches. */
export function anchorsOverlap(a: AnnotationAnchor, b: AnnotationAnchor): boolean {
  return a.blockId === b.blockId && a.start < b.end && b.start < a.end;
}

/** A one-line label for a mark in a list: its note if it has one, else its quote. */
export function annotationLabel(annotation: Annotation): string {
  const note = annotation.note?.trim();
  if (note) return note;
  return annotation.anchor?.quote ?? "";
}
