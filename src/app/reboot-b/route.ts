import { readFile } from "node:fs/promises";
import path from "node:path";

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

export async function GET(): Promise<Response> {
  const html = await readBaseHtml();
  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": ORGANIC_CACHE,
    },
  });
}
