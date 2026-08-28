"use client";

/**
 * The bridge between a mark's stored offsets and the text on screen.
 *
 * A mark is stored as offsets into the block's plain text (see
 * `src/lms-core/annotations.ts`). The browser gives us a DOM instead, so this
 * module builds a map between the two — once per block, on demand — and uses it
 * in both directions: a reader's selection becomes offsets, and stored offsets
 * become a `Range` to paint.
 *
 * WHITESPACE IS COLLAPSED IN THE MAP, not compared raw. The markup a block
 * renders carries whatever indentation and line breaks JSX happened to produce,
 * and the same paragraph read twice can differ by a newline; a quote compared
 * against that would fail to match itself. So the map emits one space for any
 * run of whitespace and remembers, per emitted character, which text node and
 * offset it came from. That is what makes an offset both stable across renders
 * and convertible back to a DOM position.
 *
 * PAINTING GOES THROUGH THE CSS CUSTOM HIGHLIGHT API rather than wrapping the
 * text in <mark> elements. Wrapping means mutating a tree React owns — the
 * classic way to get "NotFoundError: The node to be removed is not a child" on
 * the next render — and a highlight that spans an inline link would have to be
 * split across several wrappers. `CSS.highlights` paints ranges and touches no
 * nodes at all. Where it is missing the marks still exist: they are listed, and
 * the note markers still stand in the margin; only the wash on the words is
 * absent.
 */

export type BlockTextMap = {
  /** Whitespace-collapsed text of the whole block. */
  text: string;
  /** Per emitted character: the text node it came from, and the offset in it. */
  nodes: Text[];
  offsets: number[];
};

const WHITESPACE = /\s/u;

export function mapBlockText(block: HTMLElement): BlockTextMap {
  const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  const offsets: number[] = [];
  let text = "";

  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const value = node.nodeValue ?? "";
    for (let i = 0; i < value.length; i += 1) {
      const char = value[i];
      if (WHITESPACE.test(char)) {
        // One space per run, and never a leading one.
        if (text.length === 0 || text.endsWith(" ")) continue;
        text += " ";
      } else {
        text += char;
      }
      nodes.push(node as Text);
      offsets.push(i);
    }
  }

  // A trailing space belongs to no word.
  if (text.endsWith(" ")) {
    text = text.slice(0, -1);
    nodes.pop();
    offsets.pop();
  }

  return { text, nodes, offsets };
}

/**
 * Where a DOM position falls in the collapsed text; -1 when it is outside it.
 *
 * The answer is the first emitted character at or after the position, which is
 * what both ends of a range want: an inclusive start, and an exclusive end. A
 * position past the node's last emitted character lands just after it — that is
 * the reader who selected to the end of a paragraph.
 */
function indexOfPosition(map: BlockTextMap, node: Node, offset: number): number {
  let last = -1;
  for (let i = 0; i < map.nodes.length; i += 1) {
    if (map.nodes[i] !== node) continue;
    if (map.offsets[i] >= offset) return i;
    last = i;
  }
  return last >= 0 ? last + 1 : -1;
}

export type SelectionAnchor = {
  blockId: string;
  start: number;
  end: number;
  quote: string;
  prefix: string;
};

/** The block element a node sits in, and the block id it carries. */
export function blockOf(node: Node | null, root: HTMLElement): { element: HTMLElement; id: string } | null {
  let current: Node | null = node;
  while (current && current !== root) {
    if (current instanceof HTMLElement && current.id.startsWith("block-")) {
      return { element: current, id: current.id.slice("block-".length) };
    }
    current = current.parentNode;
  }
  return null;
}

/**
 * A reader's selection, as a storable anchor.
 *
 * Returns null for a selection that is empty, that reaches outside the lesson
 * body, or that spans two blocks. THE LAST ONE IS A DECISION, not a limitation
 * we failed to lift: a mark that runs from one paragraph into the next has no
 * single anchor to survive an edit between them, and the reader who drags past
 * a heading almost always meant the sentence.
 */
export function anchorFromSelection(selection: Selection, root: HTMLElement): SelectionAnchor | null {
  if (selection.isCollapsed || selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0);
  if (!root.contains(range.commonAncestorContainer)) return null;

  const startBlock = blockOf(range.startContainer, root);
  const endBlock = blockOf(range.endContainer, root);
  if (!startBlock || !endBlock || startBlock.id !== endBlock.id) return null;

  const map = mapBlockText(startBlock.element);
  const start = indexOfPosition(map, range.startContainer, range.startOffset);
  const end = indexOfPosition(map, range.endContainer, range.endOffset);
  if (start < 0 || end < 0 || end <= start) return null;

  const quote = map.text.slice(start, end).trim();
  if (!quote) return null;

  return {
    blockId: startBlock.id,
    start,
    end,
    quote,
    prefix: map.text.slice(Math.max(0, start - 40), start),
  };
}

/** Stored offsets → a live Range, or null when the passage is no longer there. */
export function rangeFromOffsets(map: BlockTextMap, start: number, end: number): Range | null {
  if (start < 0 || end > map.nodes.length || end <= start) return null;
  const range = document.createRange();
  range.setStart(map.nodes[start], map.offsets[start]);
  range.setEnd(map.nodes[end - 1], map.offsets[end - 1] + 1);
  return range;
}

export const HIGHLIGHT_NAME = "cw-reader-mark";
export const HIGHLIGHT_NOTE_NAME = "cw-reader-note";

type HighlightRegistry = {
  set: (name: string, highlight: unknown) => void;
  delete: (name: string) => void;
};

function registry(): HighlightRegistry | null {
  const css = (globalThis as { CSS?: { highlights?: HighlightRegistry } }).CSS;
  return css?.highlights ?? null;
}

/**
 * The two `::highlight()` rules, installed from here rather than from
 * globals.css.
 *
 * NOT A STYLE CHOICE — a build one. `::highlight()` names a document-wide
 * registry, so the rule cannot live in a CSS Module (its class names are
 * hashed) and it cannot live in globals.css either: Lightning CSS, which
 * Turbopack parses that file with, rejects the selector outright and takes the
 * whole stylesheet down with it. A constructed stylesheet is parsed by the
 * browser that will actually paint the marks, and a browser that does not know
 * the selector throws on `insertRule` alone — which is exactly the browser that
 * has no highlight registry to paint into either.
 *
 * A WASH, NOT A HIGHLIGHTER. The mark this system speaks is ink at two
 * strengths, not a fluorescent band: a plain mark is the accent at 18%, and one
 * carrying a note is a step stronger with the line under the words.
 * `::highlight()` accepts only colour, background-color, text-decoration and
 * text-shadow, so there is nothing else here to want.
 */
let stylesInstalled = false;

export function ensureHighlightStyles(): void {
  if (stylesInstalled || typeof document === "undefined") return;
  stylesInstalled = true;
  try {
    const sheet = new CSSStyleSheet();
    sheet.insertRule(
      `::highlight(${HIGHLIGHT_NAME}) { background-color: color-mix(in srgb, var(--cw-platform-accent) 18%, transparent); }`
    );
    sheet.insertRule(
      `::highlight(${HIGHLIGHT_NOTE_NAME}) { background-color: color-mix(in srgb, var(--cw-platform-accent) 30%, transparent); text-decoration: underline; text-decoration-color: var(--cw-platform-accent); text-underline-offset: 0.22em; }`
    );
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
  } catch {
    // No highlight registry in this browser; the marks live in the list.
  }
}

export function highlightsSupported(): boolean {
  return registry() !== null && typeof (globalThis as { Highlight?: unknown }).Highlight === "function";
}

/**
 * Paints the two groups of ranges, replacing whatever was painted before.
 *
 * The registry is global to the document, so a lesson that leaves must clear
 * its marks — otherwise the ranges of a page that no longer exists stay
 * registered and the next lesson paints over stale nodes.
 */
export function paintHighlights(plain: Range[], noted: Range[]): void {
  ensureHighlightStyles();
  const highlights = registry();
  const Ctor = (globalThis as { Highlight?: new (...ranges: Range[]) => unknown }).Highlight;
  if (!highlights || typeof Ctor !== "function") return;

  if (plain.length > 0) highlights.set(HIGHLIGHT_NAME, new Ctor(...plain));
  else highlights.delete(HIGHLIGHT_NAME);

  if (noted.length > 0) highlights.set(HIGHLIGHT_NOTE_NAME, new Ctor(...noted));
  else highlights.delete(HIGHLIGHT_NOTE_NAME);
}

export function clearHighlights(): void {
  const highlights = registry();
  if (!highlights) return;
  highlights.delete(HIGHLIGHT_NAME);
  highlights.delete(HIGHLIGHT_NOTE_NAME);
}
