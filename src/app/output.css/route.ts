import { serveStaticAsset } from "@/lib/staticAssets/serve";

export const runtime = "nodejs";

export async function GET() {
  return serveStaticAsset("", ["output.css"]);
}

