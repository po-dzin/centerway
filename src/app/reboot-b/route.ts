import { readFile } from "node:fs/promises";
import path from "node:path";

import { hasLandingCommerce, syncLandingCommerce } from "@/lib/landing/landingPrices";

// Short-Перезавантаження, variant B of the /reboot A/B test: the same product,
// price and checkout flow as /reboot, rebuilt in the newer CenterWay landing
// look (the IREM theme family). Served raw like way21/reset-day — it must NOT
// go through prepareLandingHtml, whose body pass strips inline <script> tags
// and rewrites asset paths for the managed short/irem entries.
// Sub-assets (/short-b/css, /short-b/js, /short-b/fonts) are served by the
// [brand]/[...path] catch-all because "short-b" is in LANDING_STATIC_BRANDS;
// images are reused straight from /short/img.
export const runtime = "nodejs";

const INDEX_PATH = path.join(process.cwd(), "src", "landing-static", "short-b", "index.html");

const IS_PROD = process.env.NODE_ENV === "production";

// In production the document is immutable per deploy; in dev we re-read from
// disk so HTML edits show up without a restart.
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
