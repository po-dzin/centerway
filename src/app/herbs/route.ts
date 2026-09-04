import { readFile } from "node:fs/promises";
import path from "node:path";

import { hasLandingCommerce, syncLandingCommerce } from "@/lib/landing/landingPrices";

// Canonical "Фітозбори" funnel — self-contained static landing served raw, the
// same pattern as way21/route.ts and reset-day/route.ts: it must NOT be wrapped
// in the platform layout. Sub-assets (/herbs/img, /herbs/js) are served by the
// [brand]/[...path] catch-all because "herbs" is in LANDING_STATIC_BRANDS.
//
// This route replaced a permanentRedirect to /products/herbs (removed
// 2026-08-17). The product page still exists at its own URL for the platform
// catalogue; /herbs is the funnel entry, and pointing it at the catalogue page
// meant the landing was unreachable on localhost while every other funnel was
// one path away.
//
// The CTA is a lead form ONLY WHEN THE OWNER HAS AGREED NO PRICE, and until
// 2026-09-04 this comment asserted it unconditionally while the markup carried
// `data-cw-checkout` and checkout.js charged the 1 ₴ QA amount for every click.
// The gate below is what makes the claim true, and lets it stop being true the
// day a price is set in the admin.
export const runtime = "nodejs";

const INDEX_PATH = path.join(process.cwd(), "src", "landing-static", "herbs", "index.html");

const IS_PROD = process.env.NODE_ENV === "production";

// In production the document is immutable per deploy, but in local dev we need
// fresh disk reads so route handlers reflect HTML/CSS refactors immediately.
let baseHtmlPromise: Promise<string> | null = null;
function readBaseHtml(): Promise<string> {
  if (!IS_PROD) {
    return readFile(INDEX_PATH, "utf-8");
  }

  if (baseHtmlPromise === null) {
    baseHtmlPromise = readFile(INDEX_PATH, "utf-8");
  }
  return baseHtmlPromise;
}

// Organic page is identical for everyone → let the Vercel CDN serve it.
const ORGANIC_CACHE = "public, max-age=300, s-maxage=86400, stale-while-revalidate=86400";

// A page whose figures come from the database cannot sit a day in the CDN: the
// owner changes a price in the admin and the landing must follow within
// minutes, not tomorrow. Same window `serveStaticAsset` settled on for the
// priced documents, and only pages that actually quote or charge pay it.
const COMMERCE_CACHE = "public, max-age=0, s-maxage=300, stale-while-revalidate=3600";

/* THE FUNNEL URL IS THIS ROUTE, NOT THE CATCH-ALL. `/{brand}/index.html` goes
   through `serveStaticAsset`, which reads the price from the database and
   closes a checkout the owner has not priced; this handler serves the same file
   raw, and it is the one a visitor lands on. `herbs` is what that cost: its
   hero button carried `data-cw-checkout` and charged the 1 ₴ QA amount while
   this file's own comment said the CTA was a lead form. One function for every
   door — the same rule `loadPayableOffer` follows one layer down. */
export async function GET(): Promise<Response> {
  const base = await readBaseHtml();
  const commerce = hasLandingCommerce(base);
  const html = commerce ? await syncLandingCommerce(base) : base;

  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": commerce ? COMMERCE_CACHE : ORGANIC_CACHE,
    },
  });
}
