import { readFile } from "node:fs/promises";
import path from "node:path";

// Canonical "Розвантажувальний день" mini-course funnel — light/emotional but
// premium-grade, self-contained static landing (same pattern as irem-v2/route.ts):
// raw HTML with inline CSS + js/common.js, must NOT be wrapped in the platform
// layout. Sub-assets (/reset-day/img, /reset-day/js, /reset-day/fonts) are served
// by the [brand]/[...path] catch-all because "reset-day" is in LANDING_STATIC_BRANDS.
export const runtime = "nodejs";

const INDEX_PATH = path.join(process.cwd(), "src", "landing-static", "reset-day", "index.html");

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
