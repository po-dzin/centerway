import { readFile } from "node:fs/promises";
import path from "node:path";

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

export async function serveStaticAsset(prefix: string, segments: string[]): Promise<Response> {
  const safe = safeSegments(segments);
  if (!safe) {
    return new Response("Bad request", { status: 400 });
  }

  const filePath = path.join(STATIC_ROOT, sourceDirectoryForPrefix(prefix), ...safe);
  try {
    const data = await readFile(filePath);
    const isDev = process.env.NODE_ENV !== "production";
    return new Response(data, {
      status: 200,
      headers: {
        "content-type": contentTypeByExt(filePath),
        "cache-control": isDev ? "no-store, max-age=0" : ASSET_CACHE,
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
