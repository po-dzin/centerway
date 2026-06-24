import { NextRequest } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { resolveIremLandingOffer, type LandingResolvedOffer } from "@/lib/landing/offers";

// Canonical ІВЕМ landing — served at irem.centerway.net.ua via internalFunnelRoute="/irem-v2".
// Raw static HTML with inline CSS and js/common.js; must NOT be wrapped in the platform layout.
// Sub-assets (/irem-v2/img, /irem-v2/js, /irem-v2/fonts) bypass the proxy and are served by
// the [brand]/[...path] catch-all because "irem-v2" is in LANDING_STATIC_BRANDS.
export const runtime = "nodejs";
// This handler reads the request query, so Next renders it dynamically. Cache policy
// is therefore driven entirely by the per-response Cache-Control header set below:
// organic traffic is CDN-cacheable, the personalized (offer_token) variant is private.

const INDEX_PATH = path.join(process.cwd(), "src", "landing-static", "irem-v2", "index.html");

// The base document is immutable between deploys, so read it once per lambda
// instance instead of touching disk on every request.
let baseHtmlPromise: Promise<string> | null = null;
function readBaseHtml(): Promise<string> {
  if (!baseHtmlPromise) {
    baseHtmlPromise = readFile(INDEX_PATH, "utf-8");
  }
  return baseHtmlPromise;
}

// Organic page is identical for everyone → let the Vercel CDN serve it so the
// function is only invoked on cache fills.
const ORGANIC_CACHE = "public, max-age=300, s-maxage=86400, stale-while-revalidate=86400";
// Personalized page carries a unique offer and a live countdown → never cache.
const PERSONAL_CACHE = "private, no-store";

function htmlResponse(html: string, cacheControl: string): Response {
  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": cacheControl,
    },
  });
}

function escapeAttr(value: string | number | null | undefined): string {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

function injectPersonalOffer(html: string, offer: LandingResolvedOffer): string {
  const attrs = [
    `data-cw-offer-id="${escapeAttr(offer.offerId)}"`,
    `data-cw-price-value="${escapeAttr(offer.amount)}"`,
    `data-cw-currency="${escapeAttr(offer.currency)}"`,
    `data-cw-offer-token="${escapeAttr(offer.offerToken)}"`,
    `data-cw-offer-state="${offer.offerExpired ? "expired" : "active"}"`,
    offer.issuedAt ? `data-cw-offer-issued-at="${escapeAttr(offer.issuedAt)}"` : "",
    offer.expiresAt ? `data-cw-offer-expires-at="${escapeAttr(offer.expiresAt)}"` : "",
  ]
    .filter(Boolean)
    .join(" ");

  let out = html.replace(/<html([^>]*)>/i, `<html$1 ${attrs}>`);

  const promoCss = `<style>
/* Promo deadline cluster — left-aligned to the price column, warm DS accent.
   Spacing leans on each surface's own rhythm instead of a fixed margin so it
   reads as one block with the price rather than a detached line. */
.promo-note{display:flex;flex-direction:column;gap:.18rem;align-items:flex-start;text-align:left}
.promo-note__label{font-size:.8rem;font-weight:600;line-height:1.3;letter-spacing:.01em}
.promo-timer{font-size:1.5rem;font-weight:800;line-height:1.05;font-variant-numeric:tabular-nums}
.price-stack{display:flex;align-items:baseline;gap:.5em}
/* Hero — light cream surface: strong gold for AA contrast */
.hero-actions .promo-note{margin-top:-.35rem}
.hero-actions .promo-note__label,.hero-actions .promo-timer{color:var(--cta-strong)}
/* Self-study card — dark navy surface: on-dark gold, pulled tight under price */
.fc-price+.promo-note{margin-top:-.95rem;margin-bottom:1.4rem}
.fc-price+.promo-note .promo-note__label,.fc-price+.promo-note .promo-timer{color:var(--irem-gold-soft)}
.format-card.premium .fc-price+.promo-note .promo-note__label,.format-card.premium .fc-price+.promo-note .promo-timer{color:var(--cta-strong)}
</style>`;
  out = out.replace(/<\/head>/i, `${promoCss}\n</head>`);

  const oldPriceHtml = offer.oldPriceLabel
    ? `<s style="color:var(--text-muted);font-weight:400;font-size:.85em">${offer.oldPriceLabel}</s> `
    : "";
  const promoTimerHtml = `<p class="promo-note" data-promo-note><span class="promo-note__label" data-promo-note-label>До завершення персональної ціни</span> <span class="promo-timer" data-promo-timer aria-live="polite">48:00:00</span></p>`;

  const priceBlock = (wrapperClass: string) =>
    new RegExp(
      `(<div class="${wrapperClass}">)\\s*<b>4\\s*100 грн<\\/b>\\s*<small>([^<]*)<\\/small>\\s*(<\\/div>)`,
      "i"
    );

  out = out.replace(
    priceBlock("hero-price"),
    `$1\n          ${oldPriceHtml}<b>${offer.amount} грн</b>\n          <small>$2</small>\n        $3\n        ${promoTimerHtml}`
  );
  out = out.replace(
    priceBlock("fc-price"),
    `$1\n          ${oldPriceHtml}<b>${offer.amount} грн</b>\n          <small>$2</small>\n        $3\n        ${promoTimerHtml}`
  );

  return out;
}

export async function GET(req: NextRequest) {
  const offerToken = req.nextUrl.searchParams.get("offer_token");
  const html = await readBaseHtml();

  // Organic visitors (no personal offer) get the shared, CDN-cached document.
  if (!offerToken) {
    return htmlResponse(html, ORGANIC_CACHE);
  }

  let offer: LandingResolvedOffer;
  try {
    offer = await resolveIremLandingOffer(req.nextUrl.searchParams);
  } catch (error) {
    // A DB outage must not take the landing down — degrade to the organic page.
    console.error("irem_offer_resolve_failed", error);
    return htmlResponse(html, PERSONAL_CACHE);
  }

  if (!offer.offerApplied) {
    // Unknown or expired token → fall back to the standard organic page.
    return htmlResponse(html, ORGANIC_CACHE);
  }

  return htmlResponse(injectPersonalOffer(html, offer), PERSONAL_CACHE);
}
