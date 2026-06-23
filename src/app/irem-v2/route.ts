import { NextRequest } from "next/server";
import { resolveIremLandingOffer } from "@/lib/landing/offers";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { serveStaticAsset } from "@/lib/staticAssets/serve";

// Self-contained alt/A-B landing (centerway.vercel.app/irem-v2).
// Served as raw static HTML — it ships its own <html>/<head>/<base href="/irem-v2/">,
// inline CSS and js/common.js, so it must NOT be wrapped in the platform layout.
// Sub-assets (/irem-v2/img, /irem-v2/js, /irem-v2/fonts) are served by the
// [brand]/[...path] catch-all because "irem-v2" is in LANDING_STATIC_BRANDS.
export const runtime = "nodejs";
export const revalidate = 0;

function escapeAttr(value: string | number | null | undefined): string {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

export async function GET(req: NextRequest) {
  const offer = await resolveIremLandingOffer(req.nextUrl.searchParams);

  if (!offer || !offer.offerApplied) {
    return serveStaticAsset("irem-v2", ["index.html"]);
  }

  const sourcePath = path.join(process.cwd(), "src", "landing-static", "irem-v2", "index.html");
  let html = await readFile(sourcePath, "utf-8");

  // Inject offer data-attributes onto <html> so common.js can read them
  const attrs = [
    `data-cw-offer-id="${escapeAttr(offer.offerId)}"`,
    `data-cw-price-value="${escapeAttr(offer.amount)}"`,
    `data-cw-currency="${escapeAttr(offer.currency)}"`,
    `data-cw-offer-token="${escapeAttr(offer.offerToken)}"`,
    `data-cw-offer-state="${offer.offerExpired ? "expired" : "active"}"`,
    offer.issuedAt ? `data-cw-offer-issued-at="${escapeAttr(offer.issuedAt)}"` : "",
    offer.expiresAt ? `data-cw-offer-expires-at="${escapeAttr(offer.expiresAt)}"` : "",
  ].filter(Boolean).join(" ");
  html = html.replace(/<html([^>]*)>/i, `<html$1 ${attrs}>`);

  // Inject promo-specific CSS (the standalone irem-v2 page doesn't ship these)
  const promoCss = `<style>
.promo-note{display:flex;flex-direction:column;gap:.35rem;align-items:center;text-align:center;margin-top:.75rem}
.promo-note__label{font-size:.9rem;font-weight:600;line-height:1.25;color:var(--ink-soft,#3a3f63)}
.promo-timer{color:var(--indigo,#5a6099);font-size:1.6rem;font-weight:800;line-height:1;font-variant-numeric:tabular-nums}
.price-stack{display:flex;align-items:baseline;gap:.5em}
</style>`;
  html = html.replace(/<\/head>/i, `${promoCss}\n</head>`);

  // Build promo price block: old price (strikethrough) + new price
  const oldPriceHtml = offer.oldPriceLabel
    ? `<s style="color:var(--text-muted);font-weight:400;font-size:.85em">${offer.oldPriceLabel}</s> `
    : "";
  const promoTimerHtml = `<p class="promo-note" data-promo-note><span class="promo-note__label" data-promo-note-label>До завершення персональної ціни</span> <span class="promo-timer" data-promo-timer aria-live="polite">48:00:00</span></p>`;

  // Replace hero price block (lines 584-587 in source)
  html = html.replace(
    /(<div class="hero-price">)\s*<b>4\s*100 грн<\/b>\s*<small>([^<]*)<\/small>\s*(<\/div>)/i,
    `$1\n          ${oldPriceHtml}<b>${offer.amount} грн</b>\n          <small>$2</small>\n        $3\n        ${promoTimerHtml}`
  );

  // Replace self-study card price block (lines 982-985 in source)
  html = html.replace(
    /(<div class="fc-price">)\s*<b>4\s*100 грн<\/b>\s*<small>([^<]*)<\/small>\s*(<\/div>)/i,
    `$1\n          ${oldPriceHtml}<b>${offer.amount} грн</b>\n          <small>$2</small>\n        $3\n        ${promoTimerHtml}`
  );

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=0, must-revalidate",
    },
  });
}
