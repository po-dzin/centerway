/**
 * The one letter frame every CenterWay email is poured into: receipt, welcome,
 * stream letters, broadcasts.
 *
 * WHY A FRAME AND NOT A STYLESHEET. Mail clients strip <style> blocks (Gmail
 * keeps some, Outlook renders with Word), so every rule is inline and the
 * skeleton is a table. The DS is carried by values, not by classes: the colours
 * below are the light-side platform tokens resolved to hex, because
 * `color-mix()` and custom properties do not exist in mail.
 *
 * WHAT CARRIES THE BRAND. The paper ground, one warm surface on it with a
 * hairline, the editorial serif for the one headline, Manrope for the words,
 * the warmth-coloured primary button with the ink label (the site's primary
 * button, 48 px), the wordmark on top and the spiral at the signature. Web fonts
 * load where the client allows (Apple Mail, iOS); elsewhere the fallback stack
 * keeps the same shape.
 *
 * The logo is a PNG on the public origin: SVG is not shown by Gmail.
 */

import { PLATFORM_ORIGIN } from "@/lib/surfaces/catalog";
import { escapeHtml } from "@/lib/strings";

/** Light-side platform tokens (src/app/globals.css), resolved for mail. */
export const EMAIL_TOKENS = {
  /** --cw-platform-bg (--cw-sem-calm-bg) */
  paper: "#faefe0",
  /** --cw-platform-surface */
  surface: "#fff8ef",
  /** --cw-platform-surface-muted */
  surfaceMuted: "#f3e4d0",
  /** --cw-platform-border: method ink 14% over the paper */
  border: "#dcd4c6",
  /** --cw-platform-text */
  ink: "#18261d",
  /** --cw-platform-muted */
  muted: "#48544c",
  /** --cw-text-tertiary */
  faint: "#747b73",
  /** --cw-btn-primary-bg / --cw-platform-accent */
  accent: "#e5ae65",
  /** --cw-btn-primary-text / --cw-platform-on-accent */
  onAccent: "#203126",
  /** --cw-sem-guide-primary: the text-grade accent for the eyebrow and step numbers */
  guide: "#456b58",
} as const;

const T = EMAIL_TOKENS;
const FONT_UI = `Manrope,'Segoe UI',-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif`;
const FONT_EDITORIAL = `'Cormorant Garamond',Georgia,'Times New Roman',serif`;
const FONT_DATA = `'IBM Plex Mono',ui-monospace,Menlo,Consolas,monospace`;
const FONTS_HREF =
  "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600&family=Manrope:wght@400;600;700&display=swap";

/** Inline HTML, already escaped by the caller. Plain strings go through `escapeHtml`. */
export type Html = { html: string };

export type EmailBlock =
  | { kind: "paragraph"; html: string }
  | { kind: "heading"; html: string }
  | { kind: "list"; items: string[] }
  /** Numbered rows with a hairline between them: «з чого почати». */
  | { kind: "steps"; items: { title: string; html: string }[] }
  /** A quiet panel of label → value rows: date, order, sum. */
  | { kind: "facts"; rows: { label: string; value: string }[] }
  /** A muted panel for the one thing not to miss (which email to sign in with). */
  | { kind: "note"; html: string };

export type EmailLayoutInput = {
  /** The grey line an inbox shows after the subject. */
  preheader?: string | null;
  /** Small letter-spaced line above the headline: «ПОТІК · ШЛЯХ 21». */
  eyebrow?: string | null;
  /** The one serif headline. */
  title?: string | null;
  blocks: EmailBlock[];
  cta?: { label: string; href: string } | null;
  /** Muted lines under the button: support, sign-in hint. Inline HTML. */
  after?: string[];
  /** Signature under the card; null leaves it out. */
  signature?: string | null;
  /** Small print at the very bottom (why you got this, unsubscribe). Inline HTML. */
  footer?: string[];
};

export function emailLink(href: string, label: string, tone: "ink" | "muted" = "ink"): string {
  const color = tone === "ink" ? T.ink : T.muted;
  return `<a href="${escapeHtml(href)}" style="color:${color};text-decoration:underline;text-decoration-color:${T.accent};text-underline-offset:3px">${label}</a>`;
}

function blockHtml(block: EmailBlock): string {
  const p = `margin:0 0 18px;font-family:${FONT_UI};font-size:16px;line-height:1.65;color:${T.ink}`;
  switch (block.kind) {
    case "paragraph":
      return `<p style="${p}">${block.html}</p>`;
    case "heading":
      return `<h2 style="margin:28px 0 12px;font-family:${FONT_EDITORIAL};font-size:24px;line-height:1.25;font-weight:600;color:${T.ink}">${block.html}</h2>`;
    case "list":
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 18px">${block.items
        .map(
          (item) =>
            `<tr><td valign="top" style="width:22px;padding:0 0 8px;font-family:${FONT_UI};font-size:16px;line-height:1.65;font-weight:700;color:${T.accent}">•</td><td style="padding:0 0 8px;font-family:${FONT_UI};font-size:16px;line-height:1.65;color:${T.ink}">${item}</td></tr>`,
        )
        .join("")}</table>`;
    case "steps":
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 22px">${block.items
        .map((item, index) => {
          const rule = index === 0 ? "" : `border-top:1px solid ${T.border};`;
          return `<tr><td valign="top" style="${rule}width:40px;padding:14px 0;font-family:${FONT_DATA};font-size:13px;line-height:1.9;color:${T.guide}">${String(index + 1).padStart(2, "0")}</td><td style="${rule}padding:14px 0;font-family:${FONT_UI};font-size:15px;line-height:1.6;color:${T.muted}"><div style="margin:0 0 2px;font-size:16px;font-weight:700;color:${T.ink}">${item.title}</div>${item.html}</td></tr>`;
        })
        .join("")}</table>`;
    case "facts":
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 24px;background:${T.surfaceMuted};border-radius:16px"><tr><td style="padding:6px 20px">${block.rows
        .map((row, index) => {
          const rule = index === 0 ? "" : `border-top:1px solid ${T.border};`;
          return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="${rule}padding:12px 0;font-family:${FONT_UI};font-size:14px;line-height:1.5;color:${T.muted}">${row.label}</td><td align="right" style="${rule}padding:12px 0 12px 16px;font-family:${FONT_UI};font-size:15px;line-height:1.5;font-weight:700;color:${T.ink}">${row.value}</td></tr></table>`;
        })
        .join("")}</td></tr></table>`;
    case "note":
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 22px"><tr><td style="padding:14px 18px;background:${T.surfaceMuted};border-left:3px solid ${T.accent};border-radius:4px 12px 12px 4px;font-family:${FONT_UI};font-size:15px;line-height:1.6;color:${T.ink}">${block.html}</td></tr></table>`;
  }
}

function button(cta: { label: string; href: string }): string {
  const href = escapeHtml(cta.href);
  const label = escapeHtml(cta.label);
  /* Bulletproof button: the padded <a> is the hit area; the cell carries the
     fill for clients that drop padding on inline links. */
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:10px 0 26px"><tr><td align="center" bgcolor="${T.accent}" style="border-radius:16px;background:${T.accent}"><a href="${href}" style="display:inline-block;padding:14px 28px;min-width:180px;font-family:${FONT_UI};font-size:16px;line-height:20px;font-weight:700;color:${T.onAccent};text-decoration:none;border-radius:16px;text-align:center">${label}</a></td></tr></table>`;
}

export function renderEmailLayout(input: EmailLayoutInput): string {
  const preheader = input.preheader?.trim()
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all">${escapeHtml(input.preheader.trim())}${"&#8203;&nbsp;".repeat(40)}</div>`
    : "";
  const eyebrow = input.eyebrow?.trim()
    ? `<p style="margin:0 0 10px;font-family:${FONT_UI};font-size:12px;line-height:1.4;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:${T.guide}">${escapeHtml(input.eyebrow.trim())}</p>`
    : "";
  const title = input.title?.trim()
    ? `<h1 class="cw-title" style="margin:0 0 22px;font-family:${FONT_EDITORIAL};font-size:34px;line-height:1.12;font-weight:600;letter-spacing:-0.01em;color:${T.ink}">${escapeHtml(input.title.trim())}</h1>`
    : "";
  const after = (input.after ?? [])
    .map(
      (line) =>
        `<p style="margin:0 0 10px;font-family:${FONT_UI};font-size:14px;line-height:1.6;color:${T.muted}">${line}</p>`,
    )
    .join("");
  const signature =
    input.signature === null
      ? ""
      : `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto"><tr><td valign="middle" style="padding-right:10px"><img src="${PLATFORM_ORIGIN}/cw/brand/email/cw-mark-ink@2x.png" width="28" height="28" alt="" style="display:block;border:0"></td><td valign="middle" style="font-family:${FONT_EDITORIAL};font-size:18px;line-height:1.2;font-style:italic;color:${T.ink}">${escapeHtml(input.signature ?? "Команда CenterWay")}</td></tr></table>`;
  const footer = (input.footer ?? [])
    .map(
      (line) =>
        `<p style="margin:0 0 6px;font-family:${FONT_UI};font-size:12px;line-height:1.6;color:${T.faint}">${line}</p>`,
    )
    .join("");

  return `<!doctype html>
<html lang="uk">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<link href="${FONTS_HREF}" rel="stylesheet">
<style>@media (max-width:480px){.cw-card{padding:28px 22px 22px !important}.cw-title{font-size:28px !important}}</style>
</head>
<body style="margin:0;padding:0;background:${T.paper};-webkit-text-size-adjust:100%">
${preheader}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${T.paper}" style="background:${T.paper}">
<tr><td align="center" style="padding:32px 12px 40px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px">
<tr><td align="center" style="padding:0 0 24px"><a href="${PLATFORM_ORIGIN}" style="text-decoration:none"><img src="${PLATFORM_ORIGIN}/cw/brand/email/cw-wordmark-ink@2x.png" width="150" height="36" alt="CenterWay" style="display:block;border:0;font-family:${FONT_UI};font-size:20px;font-weight:700;color:${T.ink}"></a></td></tr>
<tr><td class="cw-card" style="background:${T.surface};border:1px solid ${T.border};border-radius:20px;padding:40px 36px 30px">
${eyebrow}${title}${input.blocks.map(blockHtml).join("\n")}
${input.cta ? button(input.cta) : ""}
${after}
</td></tr>
<tr><td align="center" style="padding:28px 16px 0">${signature}</td></tr>
${footer ? `<tr><td align="center" style="padding:20px 24px 0">${footer}</td></tr>` : ""}
</table>
</td></tr>
</table>
</body>
</html>`;
}
