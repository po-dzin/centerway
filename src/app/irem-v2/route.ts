import { serveStaticAsset } from "@/lib/staticAssets/serve";

// Self-contained alt/A-B landing (centerway.vercel.app/irem-v2).
// Served as raw static HTML — it ships its own <html>/<head>/<base href="/irem-v2/">,
// inline CSS and js/common.js, so it must NOT be wrapped in the platform layout.
// Sub-assets (/irem-v2/img, /irem-v2/js, /irem-v2/fonts) are served by the
// [brand]/[...path] catch-all because "irem-v2" is in LANDING_STATIC_BRANDS.
export const runtime = "nodejs";
export const revalidate = 3600;

export async function GET() {
  return serveStaticAsset("irem-v2", ["index.html"]);
}
