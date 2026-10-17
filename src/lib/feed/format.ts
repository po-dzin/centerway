/**
 * A post's body: the small markdown subset the composer writes (2026-10-17).
 *
 * Client-safe and pure. The body is stored as the author typed it; this turns
 * it into a token tree the card maps to React elements one by one, so no
 * string of the author's ever reaches the page as HTML — there is no
 * `dangerouslySetInnerHTML` anywhere on the way.
 *
 * WHAT IT KNOWS, and nothing more (G, 17.10 — the builder's inline bar):
 *   **жирний**  *курсив*  [текст](https://…)
 *   "- " пункт списку   "1. " нумерований пункт   "> " цитата
 * A blank line ends a paragraph; a single line break stays a break.
 * `\*` writes a literal star. Anything else is text, exactly as typed.
 *
 * LINKS go only to http(s). `[x](javascript:…)`, a relative path or a malformed
 * address stays as the literal text the author typed, so nothing is silently
 * dropped and nothing unsafe becomes clickable. The card draws every link with
 * `FEED_LINK_REL` and opens it in a new tab.
 *
 * THE GATE READS TEXT, not markup: `feedGateText` is the visible words plus
 * every link's address, so a foreign link hidden behind friendly words is
 * still seen by the «посилання» check; `feedPlainText` is the visible words
 * alone — what the 4000-character limit counts and what an excerpt quotes.
 */

export type FeedInline =
  | { t: "text"; text: string }
  | { t: "br" }
  | { t: "strong"; children: FeedInline[] }
  | { t: "em"; children: FeedInline[] }
  | { t: "link"; href: string; children: FeedInline[] };

export type FeedBlockToken =
  | { t: "p"; children: FeedInline[] }
  | { t: "ul"; items: FeedInline[][] }
  | { t: "ol"; start: number; items: FeedInline[][] }
  | { t: "quote"; children: FeedInline[] };

/** `rel` for every link in a post: the author's, not the platform's endorsement. */
export const FEED_LINK_REL = "noopener nofollow ugc";

/** Deep enough for «**жирний з *курсивом* і [посиланням](…)**»; past it, text. */
const MAX_DEPTH = 4;

const ESCAPABLE = /[\\*[\]()>#_-]/;
const UL = /^\s{0,3}[-•]\s+(.*)$/;
const OL = /^\s{0,3}(\d{1,3})[.)]\s+(.*)$/;
const QUOTE = /^\s{0,3}>\s?(.*)$/;

/** An absolute http(s) address, or null. */
export function safeFeedHref(raw: string): string | null {
  const value = raw.trim();
  if (!/^https?:\/\//i.test(value)) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (!url.hostname || url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
}

/* ─────────────────────────── inline ─────────────────────────── */

const isSpace = (char: string | undefined) => char === undefined || /\s/.test(char);

/** How many stars stand in a row from `k`. */
function starRun(src: string, k: number): number {
  let n = 0;
  while (src[k + n] === "*") n += 1;
  return n;
}

/*
 * Closers, read as runs of stars. A run can close only when it touches a word
 * on its left, and open only when it touches one on its right — so
 * «2 * 3 * 4» stays arithmetic. Inside a bold, a single star opens an italic,
 * and «***» after it closes both: the italic with its first star, the bold
 * with the two after. The italic's closer mirrors it. One pass each, no
 * recursion, so a long line of stray stars costs a scan, not a tree.
 */

/** Index of the `**` closing a bold whose content starts at `from`; -1 if none. */
function closeBold(src: string, from: number): number {
  let italic = false;
  for (let k = from; k < src.length;) {
    if (src[k] === "\\") {
      k += 2;
      continue;
    }
    if (src[k] !== "*") {
      k += 1;
      continue;
    }
    const n = starRun(src, k);
    if (k > from && !isSpace(src[k - 1])) {
      if (italic && n >= 3) return k + 1;
      if (italic && n === 1) {
        italic = false;
        k += n;
        continue;
      }
      if (n >= 2) return k;
    }
    if (n === 1 && !isSpace(src[k + n])) italic = true;
    k += n;
  }
  return -1;
}

/** Index of the `*` closing an italic whose content starts at `from`; -1 if none. */
function closeItalic(src: string, from: number): number {
  let bold = false;
  for (let k = from; k < src.length;) {
    if (src[k] === "\\") {
      k += 2;
      continue;
    }
    if (src[k] !== "*") {
      k += 1;
      continue;
    }
    const n = starRun(src, k);
    if (k > from && !isSpace(src[k - 1])) {
      if (!bold) return k;
      if (n >= 2) {
        bold = false;
        if (n >= 3) return k + 2;
        k += n;
        continue;
      }
    }
    if (n >= 2 && !isSpace(src[k + n])) bold = true;
    k += n;
  }
  return -1;
}

/** `[text](url)` starting at `at`: the text, the address and where it ends; null if not a link. */
function readLink(src: string, at: number): { label: string; url: string; end: number } | null {
  let k = at + 1;
  for (; k < src.length; k += 1) {
    if (src[k] === "\\") {
      k += 1;
      continue;
    }
    if (src[k] === "[") return null;
    if (src[k] === "]") break;
  }
  if (k >= src.length || k === at + 1 || src[k + 1] !== "(") return null;
  const close = src.indexOf(")", k + 2);
  if (close < 0) return null;
  const url = src.slice(k + 2, close);
  if (!url || /\s/.test(url)) return null;
  return { label: src.slice(at + 1, k), url, end: close + 1 };
}

function parseInline(src: string, depth: number, inLink: boolean): FeedInline[] {
  const out: FeedInline[] = [];
  let buffer = "";
  const flush = () => {
    if (!buffer) return;
    const last = out[out.length - 1];
    if (last?.t === "text") last.text += buffer;
    else out.push({ t: "text", text: buffer });
    buffer = "";
  };

  for (let i = 0; i < src.length;) {
    const char = src[i] as string;
    const next = src[i + 1];

    if (char === "\\" && next !== undefined && ESCAPABLE.test(next)) {
      buffer += next;
      i += 2;
      continue;
    }

    if (depth < MAX_DEPTH && src.startsWith("**", i) && !isSpace(src[i + 2])) {
      const close = closeBold(src, i + 2);
      if (close > i + 2) {
        flush();
        out.push({ t: "strong", children: parseInline(src.slice(i + 2, close), depth + 1, inLink) });
        i = close + 2;
        continue;
      }
    } else if (depth < MAX_DEPTH && char === "*" && next !== "*" && !isSpace(next)) {
      const close = closeItalic(src, i + 1);
      if (close > i + 1) {
        flush();
        out.push({ t: "em", children: parseInline(src.slice(i + 1, close), depth + 1, inLink) });
        i = close + 1;
        continue;
      }
    }

    if (char === "[" && !inLink && depth < MAX_DEPTH) {
      const link = readLink(src, i);
      const href = link ? safeFeedHref(link.url) : null;
      if (link && href) {
        flush();
        out.push({ t: "link", href, children: parseInline(link.label, depth + 1, true) });
        i = link.end;
        continue;
      }
    }

    buffer += char;
    i += 1;
  }
  flush();
  return out;
}

/** Lines of one paragraph or quote, each parsed on its own, joined by breaks. */
function inlineLines(lines: string[]): FeedInline[] {
  const out: FeedInline[] = [];
  lines.forEach((line, index) => {
    if (index > 0) out.push({ t: "br" });
    out.push(...parseInline(line, 0, false));
  });
  return out;
}

/* ─────────────────────────── blocks ─────────────────────────── */

/** The body as blocks of inline tokens. Never throws; any string is a valid body. */
export function parseFeedBody(body: string): FeedBlockToken[] {
  const lines = String(body ?? "")
    .replace(/\r\n?/g, "\n")
    .split("\n");
  const blocks: FeedBlockToken[] = [];
  let paragraph: string[] = [];
  let quote: string[] = [];
  let list: { kind: "ul"; items: string[] } | { kind: "ol"; start: number; items: string[] } | null = null;

  const end = () => {
    if (paragraph.length) blocks.push({ t: "p", children: inlineLines(paragraph) });
    if (quote.length) blocks.push({ t: "quote", children: inlineLines(quote) });
    if (list) {
      const items = list.items.map((item) => parseInline(item, 0, false));
      blocks.push(list.kind === "ul" ? { t: "ul", items } : { t: "ol", start: list.start, items });
    }
    paragraph = [];
    quote = [];
    list = null;
  };

  for (const line of lines) {
    if (!line.trim()) {
      end();
      continue;
    }
    const ul = UL.exec(line);
    const ol = ul ? null : OL.exec(line);
    const q = ul || ol ? null : QUOTE.exec(line);
    if (ul) {
      if (list?.kind !== "ul") end();
      list ??= { kind: "ul", items: [] };
      list.items.push(ul[1] ?? "");
    } else if (ol) {
      if (list?.kind !== "ol") end();
      list ??= { kind: "ol", start: Number(ol[1]), items: [] };
      list.items.push(ol[2] ?? "");
    } else if (q) {
      if (!quote.length) end();
      quote.push(q[1] ?? "");
    } else {
      if (!paragraph.length) end();
      paragraph.push(line.trim());
    }
  }
  end();
  return blocks;
}

/* ─────────────────────────── plain text ─────────────────────────── */

function inlineText(nodes: FeedInline[], withUrls: boolean): string {
  return nodes
    .map((node) => {
      switch (node.t) {
        case "text":
          return node.text;
        case "br":
          return "\n";
        case "link": {
          const label = inlineText(node.children, withUrls);
          return withUrls ? `${label} (${node.href})` : label;
        }
        default:
          return inlineText(node.children, withUrls);
      }
    })
    .join("");
}

function blocksText(blocks: FeedBlockToken[], withUrls: boolean): string {
  return blocks
    .map((block) => {
      switch (block.t) {
        case "ul":
          return block.items.map((item) => `• ${inlineText(item, withUrls)}`).join("\n");
        case "ol":
          return block.items.map((item, index) => `${block.start + index}. ${inlineText(item, withUrls)}`).join("\n");
        default:
          return inlineText(block.children, withUrls);
      }
    })
    .join("\n\n");
}

/** The words a reader sees, without markup — what the length limit counts and an excerpt quotes. */
export function feedPlainText(body: string): string {
  return blocksText(parseFeedBody(body), false);
}

/**
 * What the automatic check reads: the visible words, and every link's address
 * beside its words. A raw address the author left unformatted is already text.
 */
export function feedGateText(body: string): string {
  return blocksText(parseFeedBody(body), true);
}
