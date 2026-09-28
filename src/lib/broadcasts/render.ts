/**
 * A broadcast's words, turned into a letter.
 *
 * PURE: no network, no database, no env. The editor's preview, the test send
 * and the real send all call this, so what the owner sees is what is mailed.
 *
 * THE MARKUP IS SMALL ON PURPOSE. A letter from CenterWay is a few paragraphs,
 * maybe a heading, a list and one button — the premium register is an
 * editorial note, not a promo grid. So the editor takes plain text with five
 * marks instead of a block builder, and everything else is escaped:
 *
 *   blank line          new paragraph
 *   # Заголовок         heading
 *   - пункт             list item
 *   **жирний**          bold
 *   [текст](https://…)  link (http, https, mailto only)
 *   {{name}}            recipient's name; {{name|друзі}} with a fallback
 *
 * The letter is poured into the shared frame (`@/lib/email/layout`), the same
 * one the receipt and the lifecycle letters use, so a campaign looks like the
 * platform and not like a newsletter tool.
 */

import { emailLink, renderEmailLayout, type EmailBlock } from "@/lib/email/layout";

export type BroadcastContent = {
  subject: string;
  preheader?: string | null;
  body: string;
  ctaLabel?: string | null;
  ctaUrl?: string | null;
};

export type RenderRecipient = {
  name?: string | null;
  unsubscribeUrl: string;
};

export type RenderedEmail = { subject: string; html: string; text: string };

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function isSafeUrl(url: string): boolean {
  return /^(https?:\/\/[^\s]+|mailto:[^\s]+)$/i.test(url.trim());
}

/** `{{name}}` / `{{name|fallback}}`. Unknown variables are left visible so a typo is caught in preview. */
export function personalize(template: string, name: string | null | undefined): string {
  return template.replace(/\{\{\s*name\s*(?:\|([^}]*))?\}\}/g, (_match, fallback: string | undefined) => {
    const clean = name?.trim();
    if (clean) return clean.split(/\s+/)[0] ?? clean;
    return (fallback ?? "").trim();
  });
}

type Block =
  { kind: "heading"; text: string } | { kind: "list"; items: string[] } | { kind: "paragraph"; lines: string[] };

export function parseBlocks(body: string): Block[] {
  const blocks: Block[] = [];
  const chunks = body.replace(/\r\n?/g, "\n").split(/\n\s*\n/);
  for (const chunk of chunks) {
    const lines = chunk
      .split("\n")
      .map((line) => line.trimEnd())
      .filter((line) => line.trim() !== "");
    if (lines.length === 0) continue;

    let paragraph: string[] = [];
    let list: string[] = [];
    const flushParagraph = () => {
      if (paragraph.length) blocks.push({ kind: "paragraph", lines: paragraph });
      paragraph = [];
    };
    const flushList = () => {
      if (list.length) blocks.push({ kind: "list", items: list });
      list = [];
    };

    for (const raw of lines) {
      const line = raw.trim();
      const heading = /^#{1,3}\s+(.+)$/.exec(line);
      const item = /^[-•*]\s+(.+)$/.exec(line);
      if (heading) {
        flushParagraph();
        flushList();
        blocks.push({ kind: "heading", text: heading[1] ?? "" });
      } else if (item) {
        flushParagraph();
        list.push(item[1] ?? "");
      } else {
        flushList();
        paragraph.push(line);
      }
    }
    flushParagraph();
    flushList();
  }
  return blocks;
}

const LINK_RE = /\[([^\]]+)\]\(([^)\s]+)\)/g;

function inlineHtml(text: string): string {
  // Split on links first so their URLs are never touched by the bold pass.
  let out = "";
  let last = 0;
  for (const match of text.matchAll(LINK_RE)) {
    out += boldHtml(text.slice(last, match.index));
    const [, label = "", url = ""] = match;
    out += isSafeUrl(url) ? emailLink(url, boldHtml(label)) : boldHtml(match[0]);
    last = (match.index ?? 0) + match[0].length;
  }
  return out + boldHtml(text.slice(last));
}

function boldHtml(text: string): string {
  return escapeHtml(text).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}

function inlineText(text: string): string {
  return text
    .replace(LINK_RE, (whole, label: string, url: string) => (isSafeUrl(url) ? `${label} (${url})` : whole))
    .replace(/\*\*(.+?)\*\*/g, "$1");
}

export function renderBroadcastEmail(content: BroadcastContent, recipient: RenderRecipient): RenderedEmail {
  const subject = personalize(content.subject, recipient.name).trim();
  const preheader = personalize(content.preheader ?? "", recipient.name).trim();
  const blocks = parseBlocks(personalize(content.body, recipient.name));
  const cta =
    content.ctaLabel?.trim() && content.ctaUrl?.trim() && isSafeUrl(content.ctaUrl)
      ? { label: personalize(content.ctaLabel, recipient.name).trim(), url: content.ctaUrl.trim() }
      : null;

  const footerNote = "Ви отримали цей лист, бо залишали свою адресу на CenterWay.";
  const unsubscribeLabel = "Відписатися від розсилки";

  const htmlBlocks = blocks.map((block): EmailBlock => {
    if (block.kind === "heading") return { kind: "heading", html: inlineHtml(block.text) };
    if (block.kind === "list") return { kind: "list", items: block.items.map(inlineHtml) };
    return { kind: "paragraph", html: block.lines.map(inlineHtml).join("<br>") };
  });

  const html = renderEmailLayout({
    preheader,
    blocks: htmlBlocks,
    cta: cta ? { label: cta.label, href: cta.url } : null,
    signature: "CenterWay",
    footer: [`${escapeHtml(footerNote)} ${emailLink(recipient.unsubscribeUrl, unsubscribeLabel, "muted")}.`],
  });

  const textParts = blocks.map((block) => {
    if (block.kind === "heading") return inlineText(block.text).toUpperCase();
    if (block.kind === "list") return block.items.map((item) => `— ${inlineText(item)}`).join("\n");
    return block.lines.map(inlineText).join("\n");
  });
  if (cta) textParts.push(`${cta.label}: ${cta.url}`);
  textParts.push("CenterWay", `${footerNote}\n${unsubscribeLabel}: ${recipient.unsubscribeUrl}`);

  return { subject, html, text: textParts.join("\n\n") };
}
