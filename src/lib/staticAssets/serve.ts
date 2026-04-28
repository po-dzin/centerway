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

export async function serveStaticAsset(prefix: string, segments: string[]): Promise<Response> {
  const safe = safeSegments(segments);
  if (!safe) {
    return new Response("Bad request", { status: 400 });
  }

  const filePath = path.join(STATIC_ROOT, prefix, ...safe);
  try {
    const data = await readFile(filePath);
    const isDev = process.env.NODE_ENV !== "production";
    return new Response(data, {
      status: 200,
      headers: {
        "content-type": contentTypeByExt(filePath),
        "cache-control": isDev ? "no-store, max-age=0" : "public, max-age=3600",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
