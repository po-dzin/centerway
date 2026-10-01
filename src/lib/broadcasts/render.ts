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
 * Inline styles and no tables, as in the purchase receipt: mail clients strip
 * <style> blocks.
 */

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

const INK = "#2b2723";
const MUTED = "#6b625a";
const FAINT = "#9a9089";

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
      return `<a href="${escapeHtml(raw)}" style="color:${INK}">${label}</a>`;
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

  const htmlBlocks = blocks.map((block) => {
    if (block.kind === "heading") {
      return `<h2 style="margin:0 0 16px;font-size:20px;line-height:1.3">${inlineHtml(escapeHtml(block.text))}</h2>`;
    }
    if (block.kind === "list") {
      const items = block.items.map((item) => `<li style="margin:0 0 6px">${inlineHtml(escapeHtml(item))}</li>`);
      return `<ul style="margin:0 0 20px;padding-left:22px">${items.join("")}</ul>`;
    }
    return `<p style="margin:0 0 20px">${block.lines.map((line) => inlineHtml(escapeHtml(line))).join("<br>")}</p>`;
  });

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

  const html = `<!doctype html><html lang="uk"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(subject)}</title></head><body style="margin:0;background:#ffffff">
${preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(preheader)}</div>` : ""}
<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:16px;line-height:1.6;color:${INK};max-width:560px;margin:0 auto;padding:24px">
${unmark(htmlBlocks.join("\n"), values, true)}
${cta ? `<p style="margin:8px 0 28px"><a href="${escapeHtml(cta.url)}" style="display:inline-block;background:${INK};color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:700">${escapeHtml(cta.label)}</a></p>` : ""}
<p style="margin:32px 0 0;color:${FAINT};font-size:13px;line-height:1.5">${escapeHtml(footerWhy)}<br><a href="${escapeHtml(unsubscribeUrl)}" style="color:${MUTED}">${escapeHtml(footerOut)}</a></p>
</div></body></html>`;

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
