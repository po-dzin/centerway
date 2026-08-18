/**
 * CenterWay LMS core — inline text model.
 *
 * PURE TS. No DOM, no React, no Next, no npm deps.
 * See docs/lms-research-2026-08-15.md §5A: everything in lms-core must run
 * unchanged inside a React Native runtime.
 *
 * Rich text is never HTML. It is a list of inline spans, which every renderer
 * (web, native, Telegram digest, agent answer) can map onto its own primitives.
 */

export type InlineSpan = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  /** External or internal link target. Renderers decide how to open it. */
  href?: string;
};

/** Authoring shorthand: a bare string is a single unstyled span. */
export type InlineText = string | InlineSpan[];

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

export function validateInlineText(value: unknown, path: string): asserts value is InlineText {
  if (typeof value === "string") {
    assert(value.trim().length > 0, `lms_inline_empty_string:${path}`);
    return;
  }

  assert(Array.isArray(value), `lms_inline_invalid_type:${path}`);
  assert(value.length > 0, `lms_inline_empty_spans:${path}`);

  value.forEach((span, index) => {
    assert(isRecord(span), `lms_inline_invalid_span:${path}[${index}]`);
    assert(isNonEmptyString(span.text), `lms_inline_span_missing_text:${path}[${index}]`);
    if (span.href !== undefined) {
      assert(isNonEmptyString(span.href), `lms_inline_span_invalid_href:${path}[${index}]`);
    }
  });
}

/** Normalizes authoring shorthand into the canonical span list. */
export function toSpans(value: InlineText): InlineSpan[] {
  return typeof value === "string" ? [{ text: value }] : value;
}

/** Flattens to plain text — used by digests, search, and agent context. */
export function inlineToPlainText(value: InlineText): string {
  return toSpans(value)
    .map((span) => span.text)
    .join("");
}
