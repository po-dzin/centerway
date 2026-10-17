/**
 * The composer's formatting bar, as text edits (2026-10-17). Pure.
 *
 * The field is a plain `<textarea>` and the bar writes the markdown subset
 * `@/lib/feed/format` reads — «**жирний**», «*курсив*», «[слова](https://…)»,
 * lines starting «- », «1. », «> ». A contenteditable would show the bold as
 * bold, but it would also have to be turned back into that subset on every
 * keystroke, paste and undo, and every browser writes its own HTML into one;
 * the textarea stores exactly what the post will carry, and undo is the
 * browser's own.
 *
 * Each edit takes the value and the selection and answers both, so the caller
 * puts the caret back where the author expects it.
 */

export type TextEdit = { value: string; start: number; end: number };

export type InlineMark = "bold" | "italic";
export type LineMark = "ul" | "ol" | "quote";

const MARKER: Record<InlineMark, string> = { bold: "**", italic: "*" };

/**
 * The selection, without the spaces at its edges: «**слово **» does not parse
 * as bold (a closer must touch a word), so a double-click that took the space
 * after the word must not produce it.
 */
function trimmed(value: string, start: number, end: number): [number, number] {
  let from = start;
  let to = end;
  while (from < to && /\s/.test(value[from] ?? "")) from += 1;
  while (to > from && /\s/.test(value[to - 1] ?? "")) to -= 1;
  return [from, to];
}

/** Whether `[from, to)` is wrapped by exactly this marker (not by a longer run). */
function wrappedBy(value: string, from: number, to: number, marker: string): boolean {
  const before = value.slice(from - marker.length, from);
  const after = value.slice(to, to + marker.length);
  if (before !== marker || after !== marker) return false;
  if (marker === "*") {
    // «**x**» is bold, not italic inside stars: the run must be one star wide.
    const outerBefore = value[from - 2];
    const outerAfter = value[to + 1];
    if (outerBefore === "*" && outerAfter === "*") {
      // «***x***» — bold and italic; the inner single star is the italic.
      return value[from - 3] === "*" && value[to + 2] === "*";
    }
    return outerBefore !== "*" && outerAfter !== "*";
  }
  return true;
}

/**
 * Bold or italic around the selection, or taken off when it is already there.
 * With nothing selected the markers go in pairs at the caret, which then sits
 * between them, ready to type.
 */
export function toggleInline(value: string, start: number, end: number, mark: InlineMark): TextEdit {
  const marker = MARKER[mark];
  const [from, to] = trimmed(value, start, end);
  if (from === to) {
    const next = `${value.slice(0, start)}${marker}${marker}${value.slice(end)}`;
    return { value: next, start: start + marker.length, end: start + marker.length };
  }
  if (wrappedBy(value, from, to, marker)) {
    const next = `${value.slice(0, from - marker.length)}${value.slice(from, to)}${value.slice(to + marker.length)}`;
    return { value: next, start: from - marker.length, end: to - marker.length };
  }
  // The selection itself carries the markers: «**слово**» selected whole.
  const inner = value.slice(from, to);
  if (inner.length > marker.length * 2 && inner.startsWith(marker) && inner.endsWith(marker)) {
    const bare = inner.slice(marker.length, inner.length - marker.length);
    const isLonger = marker === "*" && bare.startsWith("*") && !bare.startsWith("**");
    if (!isLonger) {
      const next = `${value.slice(0, from)}${bare}${value.slice(to)}`;
      return { value: next, start: from, end: from + bare.length };
    }
  }
  const next = `${value.slice(0, from)}${marker}${inner}${marker}${value.slice(to)}`;
  return { value: next, start: from + marker.length, end: to + marker.length };
}

/**
 * The selected words as a link to `href`. With nothing selected the address
 * itself becomes the words. Only the caller decides the address is safe
 * (`safeFeedHref`); this only writes it.
 */
export function insertLink(value: string, start: number, end: number, href: string): TextEdit {
  const [from, to] = trimmed(value, start, end);
  const words = from === to ? href : value.slice(from, to).replace(/[[\]]/g, "");
  const at = from === to ? start : from;
  const until = from === to ? end : to;
  const link = `[${words}](${href})`;
  const next = `${value.slice(0, at)}${link}${value.slice(until)}`;
  return { value: next, start: at + 1, end: at + 1 + words.length };
}

const LINE_PREFIX: Record<LineMark, RegExp> = {
  ul: /^\s{0,3}[-•]\s+/,
  ol: /^\s{0,3}\d{1,3}[.)]\s+/,
  quote: /^\s{0,3}>\s?/,
};

/**
 * A list or a quote over every line the selection touches; taken off when
 * every one of those lines already is one. A line that was another kind (a
 * quote turned into a list) loses its old prefix. Blank lines stay blank.
 */
export function toggleLines(value: string, start: number, end: number, mark: LineMark): TextEdit {
  const lineStart = value.lastIndexOf("\n", start - 1) + 1;
  const nextBreak = value.indexOf("\n", end > start && value[end - 1] === "\n" ? end - 1 : end);
  const lineEnd = nextBreak === -1 ? value.length : nextBreak;
  const lines = value.slice(lineStart, lineEnd).split("\n");
  const filled = lines.filter((line) => line.trim());
  const all = filled.length > 0 && filled.every((line) => LINE_PREFIX[mark].test(line));

  let n = 0;
  const rewritten = lines.map((line) => {
    if (!line.trim()) return line;
    const bare = line.replace(LINE_PREFIX.ul, "").replace(LINE_PREFIX.ol, "").replace(LINE_PREFIX.quote, "");
    if (all) return bare;
    n += 1;
    return `${mark === "ul" ? "- " : mark === "ol" ? `${n}. ` : "> "}${bare}`;
  });
  // An empty line asked to become a list item gets its prefix, so typing can start.
  if (!all && filled.length === 0) rewritten[0] = mark === "ul" ? "- " : mark === "ol" ? "1. " : "> ";

  const block = rewritten.join("\n");
  const next = `${value.slice(0, lineStart)}${block}${value.slice(lineEnd)}`;
  const blockEnd = lineStart + block.length;
  // A caret stays a caret, at the end of its line; a selection keeps the lines selected.
  return { value: next, start: start === end ? blockEnd : lineStart, end: blockEnd };
}
