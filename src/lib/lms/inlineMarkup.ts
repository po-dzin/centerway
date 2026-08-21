/**
 * Lossless text form for `InlineText`, so the builder can edit it in a textarea.
 *
 * WHY THIS EXISTS. `InlineText` is either a plain string or a list of spans with
 * `bold` / `italic` / `href`. Two thirds of the span arrays in the shipped
 * courses carry real formatting, so an editor that flattened spans to plain text
 * would silently delete emphasis and links from most of the content the moment
 * an author opened a lesson and pressed save. That is the failure mode this
 * module exists to make impossible.
 *
 * WHY MARKDOWN-ISH AND NOT A RICH EDITOR. The span model has exactly three
 * features, and this dialect has exactly three constructs — so the mapping is
 * total in both directions and the round trip is provable, which is what the
 * tests assert. A contenteditable surface would be a much larger thing that
 * still had to solve this same conversion underneath.
 *
 *   **bold**            → { bold: true }
 *   *italic*            → { italic: true }
 *   [text](href)        → { href }
 *   \\* \\[ \\\\           → literal characters
 *
 * Deliberately NOT in `lms-core`: the core is the contract every RENDERER
 * shares, and a text dialect is an authoring affordance. It is pure and free of
 * app imports all the same, so the agent tools (H3) can call it too.
 */

import type { InlineSpan, InlineText } from "@/lms-core";

const ESCAPABLE = new Set(["*", "[", "]", "(", ")", "\\"]);

function escapeText(text: string): string {
  let out = "";
  for (const char of text) {
    if (ESCAPABLE.has(char)) out += "\\";
    out += char;
  }
  return out;
}

/** Spans → editable text. */
export function inlineToMarkup(value: InlineText): string {
  if (typeof value === "string") return escapeText(value);

  return value
    .map((span) => {
      let text = escapeText(span.text);
      // Order matters and is fixed: bold inside italic inside link. The parser
      // unwraps in the same order, so any combination round-trips.
      if (span.bold) text = `**${text}**`;
      if (span.italic) text = `*${text}*`;
      if (span.href) text = `[${text}](${span.href})`;
      return text;
    })
    .join("");
}

type Token = { text: string; bold: boolean; italic: boolean; href?: string };

/**
 * Editable text → spans.
 *
 * Returns a plain string when nothing is marked up, so a course that was
 * authored with bare strings does not gain span arrays just by being opened —
 * the git diff of an untouched lesson stays empty.
 */
export function markupToInline(input: string): InlineText {
  const tokens = parse(input);

  if (tokens.length === 0) return "";
  if (tokens.length === 1 && !tokens[0].bold && !tokens[0].italic && !tokens[0].href) {
    return tokens[0].text;
  }

  return tokens.map((token) => {
    const span: InlineSpan = { text: token.text };
    if (token.bold) span.bold = true;
    if (token.italic) span.italic = true;
    if (token.href) span.href = token.href;
    return span;
  });
}

function parse(input: string): Token[] {
  const tokens: Token[] = [];
  let buffer = "";
  let index = 0;
  let bold = false;
  let italic = false;

  const flush = (href?: string) => {
    if (buffer.length === 0) return;
    tokens.push({ text: buffer, bold, italic, ...(href ? { href } : {}) });
    buffer = "";
  };

  while (index < input.length) {
    const char = input[index];

    if (char === "\\" && index + 1 < input.length && ESCAPABLE.has(input[index + 1])) {
      buffer += input[index + 1];
      index += 2;
      continue;
    }

    if (char === "*" && input[index + 1] === "*") {
      flush();
      bold = !bold;
      index += 2;
      continue;
    }

    if (char === "*") {
      flush();
      italic = !italic;
      index += 1;
      continue;
    }

    if (char === "[") {
      const link = readLink(input, index);
      if (link) {
        flush();
        // A link's label is parsed too, so **bold** inside a link survives.
        for (const inner of parse(link.label)) {
          tokens.push({ ...inner, bold: inner.bold || bold, italic: inner.italic || italic, href: link.href });
        }
        index = link.end;
        continue;
      }
    }

    buffer += char;
    index += 1;
  }

  flush();
  return tokens;
}

/** Reads `[label](href)` at `start`, or null when it is just a bracket. */
function readLink(input: string, start: number): { label: string; href: string; end: number } | null {
  let index = start + 1;
  let label = "";

  while (index < input.length && input[index] !== "]") {
    if (input[index] === "\\" && index + 1 < input.length) {
      label += input[index] + input[index + 1];
      index += 2;
      continue;
    }
    label += input[index];
    index += 1;
  }

  if (input[index] !== "]" || input[index + 1] !== "(") return null;

  index += 2;
  let href = "";
  while (index < input.length && input[index] !== ")") {
    href += input[index];
    index += 1;
  }

  if (input[index] !== ")" || href.trim().length === 0 || label.trim().length === 0) return null;
  return { label, href, end: index + 1 };
}
