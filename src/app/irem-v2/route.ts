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
/* Personalized promo = struck base price + a compact urgency pill. The pill reuses
   the site's chip/badge pattern (pill radius, status dot, warm tint) so it reads as
   a native part of the layout rather than an injected line, and stays one tight
   block under the price instead of skewing the column. Recoloured per surface:
   cta-strong on the light hero, irem-gold-soft on the dark self-study card. */
.price-stack{display:inline-flex;align-items:baseline;gap:.4em;flex-wrap:wrap}
.price-old{font-family:var(--f-display);font-weight:400;font-size:.6em;text-decoration:line-through;color:var(--text-soft)}
.format-card.self .price-old{color:rgba(255,255,255,.55)}
.promo-note{display:inline-flex;align-items:center;gap:.5em;margin-top:.75rem;
  padding:.5em .8em .5em .7em;border-radius:var(--r-pill);line-height:1;font-size:.8rem;
  background:rgba(221,109,12,.10);border:1px solid rgba(221,109,12,.22)}
.promo-note::before{content:"";flex:0 0 auto;width:6px;height:6px;border-radius:50%;
  background:var(--cta);box-shadow:0 0 0 3px rgba(221,109,12,.16)}
.promo-note__label{color:var(--cta-strong);font-weight:600}
.promo-timer{color:var(--cta-strong);font-family:var(--f-mono);font-weight:700;
  font-variant-numeric:tabular-nums;letter-spacing:.02em;font-size:.92rem}
/* Self-study card — dark navy surface: warm gold pill */
.fc-price+.promo-note{margin-top:1rem;margin-bottom:.2rem;
  background:rgba(240,163,90,.12);border-color:rgba(240,163,90,.32)}
.fc-price+.promo-note::before{background:var(--irem-gold-soft);box-shadow:0 0 0 3px rgba(240,163,90,.18)}
.fc-price+.promo-note .promo-note__label,.fc-price+.promo-note .promo-timer{color:var(--irem-gold-soft)}
</style>`;
  out = out.replace(/<\/head>/i, `${promoCss}\n</head>`);

  // Struck base price + new current price, wrapped in .price-stack with the
  // .price-old / .price-current hooks the countdown script needs to revert the
  // price in place once the personal offer expires.
  const oldPriceHtml = offer.oldPriceLabel
    ? `<s class="price-old">${offer.oldPriceLabel}</s> `
    : "";
  const promoTimerHtml = `<p class="promo-note" data-promo-note><span class="promo-note__label" data-promo-note-label>Персональна ціна діє ще</span> <span class="promo-timer" data-promo-timer aria-live="polite">48:00:00</span></p>`;

  const priceBlock = (wrapperClass: string) =>
    new RegExp(
      `(<div class="${wrapperClass}">)\\s*<b>4\\s*100 грн<\\/b>\\s*<small>([^<]*)<\\/small>\\s*(<\\/div>)`,
      "i"
    );

  const priceReplacement =
    `$1\n          <span class="price-stack">${oldPriceHtml}<b class="price-current">${offer.amount} грн</b></span>\n          <small>$2</small>\n        $3\n        ${promoTimerHtml}`;

  out = out.replace(priceBlock("hero-price"), priceReplacement);
  out = out.replace(priceBlock("fc-price"), priceReplacement);

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
