import { readFile } from "node:fs/promises";
import path from "node:path";

// Canonical "Фітозбори" funnel — self-contained static landing served raw, the
// same pattern as way21/route.ts and reset-day/route.ts: it must NOT be wrapped
// in the platform layout. Sub-assets (/herbs/img, /herbs/js) are served by the
// [brand]/[...path] catch-all because "herbs" is in LANDING_STATIC_BRANDS.
//
// This route replaced a permanentRedirect to /products/herbs (removed
// 2026-08-17). The product page still exists at its own URL for the platform
// catalogue; /herbs is the funnel entry, and pointing it at the catalogue page
// meant the landing was unreachable on localhost while every other funnel was
// one path away. ctaMode stays "redirect" — the landing's CTA is a lead form,
// not a checkout.
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

export async function GET(): Promise<Response> {
  const html = await readBaseHtml();
  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": ORGANIC_CACHE,
    },
  });
}
