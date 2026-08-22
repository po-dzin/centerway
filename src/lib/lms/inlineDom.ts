/**
 * `InlineText` ⇄ a tiny markup tree, so the builder can edit spans in a rich
 * surface instead of asking the author to type `**зірочки**`.
 *
 * WHY A TREE AND NOT THE DOM. Everything here is pure: the node type below is a
 * structural stand-in for `Node`, so the conversion is unit-tested without a
 * browser (vitest runs on `node`, there is no jsdom in this repo) and would run
 * unchanged under a native renderer's own text model. The component adapts real
 * DOM nodes onto this type in about ten lines; the rules live here.
 *
 * WHAT IT MUST NOT DO. The span model has exactly three features and this
 * conversion has exactly three, in both directions — the same totality the
 * markup dialect in `inlineMarkup.ts` is tested for. Two rules carry it:
 *
 *   · **plain stays plain.** A value that was a bare string comes back a bare
 *     string, never a one-element span array. A third of the inline values in
 *     the shipped courses are bare strings, and gaining span arrays just by
 *     being opened is how an untouched lesson grows a diff.
 *   · **only set keys.** `{ text, bold: true }`, never `{ text, bold: undefined,
 *     italic: undefined }` — the second serialises to different JSON for the
 *     same content.
 *
 * The markup dialect is NOT retired. It stays as the per-field escape hatch
 * (contenteditable is genuinely unreliable on mobile Safari) and as the text
 * form the CLI and the author's agent use.
 */

import type { InlineSpan, InlineText } from "@/lms-core";

/** A structural stand-in for a DOM node — the subset this conversion needs. */
export type MarkupNode =
  | { kind: "text"; text: string }
  | { kind: "element"; tag: string; href?: string; children: MarkupNode[] };

type Style = { bold?: true; italic?: true; href?: string };

const BOLD_TAGS = new Set(["b", "strong"]);
const ITALIC_TAGS = new Set(["i", "em"]);

/**
 * Tags that end a line. The span model has no line break at all, so they
 * become a single space rather than being dropped: joining "рядок" and "далі"
 * into "рядокдалі" invents a word the author never wrote.
 */
const BREAK_TAGS = new Set(["br", "div", "p"]);

export function nodesToInline(nodes: MarkupNode[]): InlineText {
  const spans: InlineSpan[] = [];

  const push = (text: string, style: Style) => {
    if (text.length === 0) return;
    const last = spans[spans.length - 1];
    // Coalesce, or a keystroke inside a word splits it into two spans and the
    // stored value grows a seam every time it is edited.
    if (last && last.bold === style.bold && last.italic === style.italic && last.href === style.href) {
      last.text += text;
      return;
    }
    spans.push({ text, ...style });
  };

  const walk = (node: MarkupNode, style: Style, index: number) => {
    if (node.kind === "text") {
      push(node.text, style);
      return;
    }

    const tag = node.tag.toLowerCase();
    if (tag === "br") {
      push(" ", style);
      return;
    }

    const next: Style = { ...style };
    if (BOLD_TAGS.has(tag)) next.bold = true;
    if (ITALIC_TAGS.has(tag)) next.italic = true;
    // An <a> with no href is what a half-applied link looks like mid-edit. It
    // carries no target, so it carries no formatting either.
    if (tag === "a" && node.href) next.href = node.href;

    // A block that is not the first child started on its own line.
    if (BREAK_TAGS.has(tag) && index > 0) push(" ", style);
    node.children.forEach((child, childIndex) => walk(child, next, childIndex));
  };

  nodes.forEach((node, index) => walk(node, {}, index));

  if (spans.length === 0) return "";
  if (spans.length === 1 && !spans[0].bold && !spans[0].italic && !spans[0].href) {
    return spans[0].text;
  }
  return spans;
}

/**
 * Spans → the tree the editor renders.
 *
 * Nesting order is fixed — bold inside italic inside link — and it is the SAME
 * order `inlineToMarkup` writes. Two authoring surfaces that disagreed on it
 * would produce different trees for one value, and the difference would show up
 * as a diff on a lesson nobody edited.
 */
export function inlineToNodes(value: InlineText): MarkupNode[] {
  const spans = typeof value === "string" ? [{ text: value }] : value;

  return spans.map((span) => {
    let node: MarkupNode = { kind: "text", text: span.text };
    if (span.bold) node = { kind: "element", tag: "b", children: [node] };
    if (span.italic) node = { kind: "element", tag: "i", children: [node] };
    if (span.href) node = { kind: "element", tag: "a", href: span.href, children: [node] };
    return node;
  });
}

const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
};

function escapeHtml(text: string): string {
  return text.replace(/[&<>"]/g, (char) => ESCAPES[char]);
}

/**
 * The tree as an HTML string, for seeding a contenteditable.
 *
 * Every text node and every href is escaped. Authored content is data, and a
 * course whose paragraph happens to contain `<script>` must produce the five
 * characters the author typed — not a script tag, and not a hole.
 */
export function inlineToHtml(value: InlineText): string {
  const render = (node: MarkupNode): string => {
    if (node.kind === "text") return escapeHtml(node.text);
    const inner = node.children.map(render).join("");
    if (node.tag === "a") return `<a href="${escapeHtml(node.href ?? "")}">${inner}</a>`;
    return `<${node.tag}>${inner}</${node.tag}>`;
  };

  return inlineToNodes(value).map(render).join("");
}
