import { readFile } from "node:fs/promises";
import path from "node:path";

import { hasLandingCommerce, syncLandingCommerce } from "@/lib/landing/landingPrices";

const STATIC_ROOT = path.join(process.cwd(), "src", "landing-static");

const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".ttf": "font/ttf",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
};

function safeSegments(input: string[]): string[] | null {
  const cleaned = input.filter(Boolean);
  for (const part of cleaned) {
    if (part === "." || part === ".." || part.includes("\0")) {
      return null;
    }
  }
  return cleaned;
}

function contentTypeByExt(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  return CONTENT_TYPES[ext] ?? "application/octet-stream";
}

function sourceDirectoryForPrefix(prefix: string): string {
  if (prefix === "reboot") return "short";
  return prefix;
}

/**
 * Browser: an hour, as before. CDN: until the next deployment.
 *
 * These files live in the repository and are read off the function's own disk,
 * so every cache miss is an invocation — and with `max-age` alone the edge
 * entry expired hourly, which measured as `x-vercel-cache: MISS` on a cold
 * asset all day long. `s-maxage` is what the shared cache reads, and a year of
 * it is safe precisely BECAUSE the files are baked into the deployment: a
 * changed image is a new deployment, and a new deployment is a new cache.
 *
 * The browser half stays short on purpose. A visitor who saw a landing this
 * morning should see this afternoon's price photo, and one hour of staleness
 * is the price of not having to fingerprint filenames on a hand-written page.
 */
const ASSET_CACHE = "public, max-age=3600, s-maxage=31536000, stale-while-revalidate=86400";

/**
 * A page that prints a live price cannot be cached until the next deployment.
 *
 * The year above is safe for a file whose only source of truth is the file —
 * an image changes when the repository does. A price does not: it lives in
 * `lms_course_offers`, an owner can change it this afternoon, and the whole
 * point of the sync is that the change reaches the page. Cached for a year, a
 * landing would advertise last month's figure over a checkout charging the new
 * one, which is the failure this was built to end, only slower.
 *
 * Five minutes rather than zero: these are the pages paid traffic lands on, and
 * they are worth serving from the edge. `stale-while-revalidate` means a price
 * change shows up on the next request after that window and nobody waits for a
 * database read to see a landing page.
 *
 * Only pages that actually carry `data-cw-price` pay this. Everything else —
 * images, stylesheets, the utility pages with no figure on them — keeps the
 * long cache, so the cost is scoped to the handful of documents that quote
 * money.
 */
const PRICED_HTML_CACHE = "public, max-age=0, s-maxage=300, stale-while-revalidate=3600";

export async function serveStaticAsset(prefix: string, segments: string[]): Promise<Response> {
  const safe = safeSegments(segments);
  if (!safe) {
    return new Response("Bad request", { status: 400 });
  }

  const filePath = path.join(STATIC_ROOT, sourceDirectoryForPrefix(prefix), ...safe);
  try {
    const data = await readFile(filePath);
    const isDev = process.env.NODE_ENV !== "production";
    const contentType = contentTypeByExt(filePath);

    /* HTML is the only thing here that can quote a price or open a checkout,
       and most of it does neither. `hasLandingCommerce` on the decoded text is
       the cheap test that keeps every other asset on the path it had before
       this existed. */
    if (contentType.startsWith("text/html")) {
      const html = data.toString("utf-8");
      if (hasLandingCommerce(html)) {
        const synced = await syncLandingCommerce(html);
        return new Response(synced, {
          status: 200,
          headers: {
            "content-type": contentType,
            "cache-control": isDev ? "no-store, max-age=0" : PRICED_HTML_CACHE,
          },
        });
      }
    }

    return new Response(data, {
      status: 200,
      headers: {
        "content-type": contentType,
        "cache-control": isDev ? "no-store, max-age=0" : ASSET_CACHE,
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
