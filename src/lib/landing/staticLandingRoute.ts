import { readFile } from "node:fs/promises";
import path from "node:path";

import { hasLandingCommerce, syncLandingCommerce } from "@/lib/landing/landingPrices";

/**
 * A raw static landing, served as the funnel's entry.
 *
 * Four route files — way21, reset-day, herbs, reboot-b — were this function
 * copied four times with the brand name changed. They differ in their header
 * comments, which stayed in the route files where they belong.
 *
 * THE FUNNEL URL IS THE ROUTE, NOT THE CATCH-ALL. `/{brand}/index.html` goes
 * through `serveStaticAsset`, which reads the price from the database and
 * closes a checkout the owner has not priced; this serves the same file raw,
 * and it is the one a visitor lands on. `herbs` is what that cost: its hero
 * button carried `data-cw-checkout` and charged the 1 ₴ QA amount while the
 * file's own comment said the CTA was a lead form. One function for every
 * door — the same rule `loadPayableOffer` follows one layer down.
 */

const IS_PROD = process.env.NODE_ENV === "production";

// Organic page is identical for everyone → let the Vercel CDN serve it.
const ORGANIC_CACHE = "public, max-age=300, s-maxage=86400, stale-while-revalidate=86400";

// A page whose figures come from the database cannot sit a day in the CDN: the
// owner changes a price in the admin and the landing must follow within
// minutes, not tomorrow. Same window `serveStaticAsset` settled on for the
// priced documents, and only pages that actually quote or charge pay it.
const COMMERCE_CACHE = "public, max-age=0, s-maxage=300, stale-while-revalidate=3600";

export function createStaticLandingGet(brand: string): () => Promise<Response> {
  const indexPath = path.join(process.cwd(), "src", "landing-static", brand, "index.html");

  // In production the document is immutable per deploy; in dev it is re-read
  // from disk so HTML edits show up without a restart.
  let baseHtmlPromise: Promise<string> | null = null;
  function readBaseHtml(): Promise<string> {
    if (!IS_PROD) return readFile(indexPath, "utf-8");
    if (baseHtmlPromise === null) baseHtmlPromise = readFile(indexPath, "utf-8");
    return baseHtmlPromise;
  }

  return async function GET(): Promise<Response> {
    const base = await readBaseHtml();
    const commerce = hasLandingCommerce(base);
    const html = commerce ? await syncLandingCommerce(base) : base;
    return new Response(html, {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": commerce ? COMMERCE_CACHE : ORGANIC_CACHE,
      },
    });
  };
}
