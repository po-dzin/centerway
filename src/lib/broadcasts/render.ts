/**
 * A broadcast's words, made into one recipient's message.
 *
 * Pure: no network, no database, no clock. The editor's preview, the test send
 * and the real send all call this, so what the owner approves on screen is the
 * message that goes out, byte for byte except the name and the link.
 *
 * THE MARKUP IS SMALL ON PURPOSE. Paragraphs separated by a blank line, a line
 * starting `# ` for a heading, lines starting `- ` for a list, `**bold**`,
 * `[text](https://…)`, and `{{name}}` / `{{first_name}}` with an optional
 * fallback after a bar: `{{first_name|друже}}`. Anything richer is a template
 * engine, and a template engine in an admin textarea is a way to send a broken
 * message to three hundred people. Everything typed is escaped first and the
 * markup applied to the escaped text, so a `<` in a letter is a `<` on screen.
 *
 * The words are poured into the platform's one mail frame (`email/layout.ts`),
 * the same paper, card and button as the receipt and the lifecycle letters.
 */

import { emailLink, renderEmailLayout, type EmailBlock } from "@/lib/email/layout";
import { escapeHtml } from "@/lib/strings";

export type BroadcastContent = {
  subject: string;
  preheader: string;
  body: string;
  ctaLabel: string | null;
  ctaUrl: string | null;
};

export type RenderedBroadcast = {
  subject: string;
  html: string;
  text: string;
  headers: Record<string, string>;
};

/* Placeholders are swapped for a sentinel before markup and for the escaped
   name after it, so a name that happens to contain `**` or `[x](https://…)`
   is printed, never interpreted. */
const NAME_MARK = "\u0000N\u0000";
const FIRST_MARK = "\u0000F\u0000";
const PLACEHOLDER = /\{\{\s*(name|first_name)\s*(?:\|([^}]*))?\}\}/g;

export function isSafeUrl(url: string | null | undefined): url is string {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

function firstName(name: string | null): string | null {
  const first = name?.trim().split(/\s+/)[0];
  return first || null;
}

/** `{{name|fallback}}` resolved to what this recipient gets, as plain text. */
export function resolvePlaceholders(source: string, name: string | null): string {
  return source.replace(PLACEHOLDER, (_match, which: string, fallback: string | undefined) => {
    const value = which === "first_name" ? firstName(name) : name?.trim() || null;
    return value ?? (fallback ?? "").trim();
  });
}

function marked(source: string, name: string | null): { source: string; values: Map<string, string> } {
  const values = new Map<string, string>();
  const out = source.replace(PLACEHOLDER, (_match, which: string, fallback: string | undefined) => {
    const value = which === "first_name" ? firstName(name) : name?.trim() || null;
    const resolved = value ?? (fallback ?? "").trim();
    const mark = which === "first_name" ? FIRST_MARK : NAME_MARK;
    const key = `${mark}${values.size}\u0000`;
    values.set(key, resolved);
    return key;
  });
  return { source: out, values };
}

function unmark(text: string, values: Map<string, string>, escape: boolean): string {
  let out = text;
  for (const [key, value] of values)
    out = out.split(escape ? escapeHtml(key) : key).join(escape ? escapeHtml(value) : value);
  return out;
}

const LINK = /\[([^\]\n]+)\]\(([^)\s]+)\)/g;
const BOLD = /\*\*([^*\n]+)\*\*/g;

function inlineHtml(escaped: string): string {
  return escaped
    .replace(LINK, (match, label: string, url: string) => {
      // The URL was escaped with the rest; undo it to test it, re-escape to print it.
      const raw = url.replace(/&amp;/g, "&").replace(/&quot;/g, '"');
      if (!isSafeUrl(raw)) return match;
      return emailLink(raw, label);
    })
    .replace(BOLD, "<strong>$1</strong>");
}

function inlineText(source: string): string {
  return source
    .replace(LINK, (match, label: string, url: string) => (isSafeUrl(url) ? `${label} (${url})` : match))
    .replace(BOLD, "$1");
}

type Block =
  { kind: "heading"; text: string } | { kind: "list"; items: string[] } | { kind: "paragraph"; lines: string[] };

export function parseBlocks(body: string): Block[] {
  const blocks: Block[] = [];
  for (const chunk of body.replace(/\r\n?/g, "\n").split(/\n\s*\n/)) {
    const lines = chunk
      .split("\n")
      .map((line) => line.trimEnd())
      .filter((line) => line.trim() !== "");
    if (lines.length === 0) continue;
    const [only] = lines;
    if (lines.length === 1 && only !== undefined && /^#{1,3}\s+/.test(only)) {
      blocks.push({ kind: "heading", text: only.replace(/^#{1,3}\s+/, "") });
    } else if (lines.every((line) => /^\s*[-•]\s+/.test(line))) {
      blocks.push({ kind: "list", items: lines.map((line) => line.replace(/^\s*[-•]\s+/, "")) });
    } else {
      blocks.push({ kind: "paragraph", lines: lines.map((line) => line.trim()) });
    }
  }
  return blocks;
}

export function renderBroadcast(
  content: BroadcastContent,
  recipient: { name: string | null },
  unsubscribeUrl: string,
): RenderedBroadcast {
  const subject = resolvePlaceholders(content.subject, recipient.name).replace(/\s+/g, " ").trim();
  const preheader = resolvePlaceholders(content.preheader, recipient.name).trim();
  const { source, values } = marked(content.body, recipient.name);
  const blocks = parseBlocks(source);

  const htmlBlocks = blocks.map((block): EmailBlock => {
    if (block.kind === "heading") return { kind: "heading", html: inlineHtml(escapeHtml(block.text)) };
    if (block.kind === "list") return { kind: "list", items: block.items.map((item) => inlineHtml(escapeHtml(item))) };
    return { kind: "paragraph", html: block.lines.map((line) => inlineHtml(escapeHtml(line))).join("<br>") };
  });
  const finish = (html: string) => unmark(html, values, true);

  const textBlocks = blocks.map((block) => {
    if (block.kind === "heading") return inlineText(block.text).toUpperCase();
    if (block.kind === "list") return block.items.map((item) => `— ${inlineText(item)}`).join("\n");
    return block.lines.map(inlineText).join("\n");
  });

  const cta =
    content.ctaLabel?.trim() && isSafeUrl(content.ctaUrl)
      ? { label: content.ctaLabel.trim(), url: content.ctaUrl }
      : null;

  /* The footer's words are the platform's, not the campaign's: every message
     carries the same way out, and an author cannot write it away. */
  const footerWhy = "Ви отримали цей лист, бо ви з нами в CenterWay.";
  const footerOut = "Відписатися від розсилки";

  const html = renderEmailLayout({
    preheader,
    blocks: htmlBlocks.map((block): EmailBlock => {
      if (block.kind === "list") return { ...block, items: block.items.map(finish) };
      if (block.kind === "paragraph" || block.kind === "heading") return { ...block, html: finish(block.html) };
      return block;
    }),
    cta: cta ? { label: cta.label, href: cta.url } : null,
    footer: [escapeHtml(footerWhy), emailLink(unsubscribeUrl, escapeHtml(footerOut), "muted")],
  });

  const text = [
    unmark(textBlocks.join("\n\n"), values, false),
    cta ? `${cta.label}: ${cta.url}` : null,
    "",
    "—",
    footerWhy,
    `${footerOut}: ${unsubscribeUrl}`,
  ]
    .filter((line): line is string => line !== null)
    .join("\n\n")
    .replace(/\n{3,}/g, "\n\n");

  return {
    subject,
    html,
    text,
    /* RFC 2369 + RFC 8058: the mailbox's own «unsubscribe» button, which Gmail
       and Yahoo require of bulk senders. The POST target is the same URL. */
    headers: {
      "List-Unsubscribe": `<${unsubscribeUrl}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  };
}
