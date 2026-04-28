import { getUtilityPageFromAssetPath, LANDING_STATIC_BRANDS } from "@/lib/landing/contracts";
import { htmlResponse } from "@/lib/landing/http";
import { prepareLandingHtml } from "@/lib/landing/prepareLandingHtml";
import { isNextLandingEnabled } from "@/lib/landing/routing";
import { isLandingProduct } from "@/lib/landing/types";
import { serveStaticAsset } from "@/lib/staticAssets/serve";

export const runtime = "nodejs";

export async function GET(_: Request, context: { params: Promise<{ brand: string; path: string[] }> }) {
  const params = await context.params;
  const brand = params.brand;
  const assetPath = params.path ?? [];

  if (!LANDING_STATIC_BRANDS.has(brand)) {
    return new Response("Not found", { status: 404 });
  }

  if (isLandingProduct(brand)) {
    const utilityPage = getUtilityPageFromAssetPath(assetPath);
    if (utilityPage) {
      if (!isNextLandingEnabled()) {
        // Full rollback mode serves original static utility HTML.
        return serveStaticAsset(brand, assetPath);
      }
      const prepared = await prepareLandingHtml({ product: brand, pageKind: "utility", page: utilityPage });
      return htmlResponse(prepared.html);
    }
  }

  return serveStaticAsset(brand, assetPath);
}
