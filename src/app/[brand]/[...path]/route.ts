import { unstable_cache } from "next/cache";
import { getUtilityPageFromAssetPath, LANDING_STATIC_BRANDS } from "@/lib/landing/contracts";
import { htmlResponse } from "@/lib/landing/http";
import { prepareLandingHtml } from "@/lib/landing/prepareLandingHtml";
import { isNextLandingEnabled } from "@/lib/landing/routing";
import { resolveStaticLandingProduct } from "@/lib/landing/types";
import { serveStaticAsset } from "@/lib/staticAssets/serve";

export const runtime = "nodejs";
export const revalidate = 3600;

const getPreparedUtilityLandingHtml = unstable_cache(
  async (product: "short" | "irem", page: "thanks" | "pay-failed" | "public-offer") => {
    const prepared = await prepareLandingHtml({ product, pageKind: "utility", page });
    if (prepared.pageKind !== "utility") {
      throw new Error("expected_utility_landing_html");
    }
    return prepared;
  },
  ["landing-utility-html-v1"],
  { revalidate: 3600 }
);

export async function GET(_: Request, context: { params: Promise<{ brand: string; path: string[] }> }) {
  const params = await context.params;
  const brand = params.brand;
  const assetPath = params.path ?? [];

  if (!LANDING_STATIC_BRANDS.has(brand)) {
    return new Response("Not found", { status: 404 });
  }

  const staticProduct = resolveStaticLandingProduct(brand);
  if (staticProduct) {
    const utilityPage = getUtilityPageFromAssetPath(assetPath);
    if (utilityPage) {
      if (!isNextLandingEnabled()) {
        // Full rollback mode serves original static utility HTML.
        return serveStaticAsset(brand, assetPath);
      }
      // Utility pages are generated from static assets plus canonized content.
      // Cache them at the route level so the catch-all handler does not stay fully dynamic.
      const prepared = await getPreparedUtilityLandingHtml(staticProduct, utilityPage);
      return htmlResponse(prepared.html);
    }
  }

  return serveStaticAsset(brand, assetPath);
}
