import { unstable_cache } from "next/cache";
import { LANDING_CONTENT } from "@/lib/landing/content";
import { getUtilityPageFromAssetPath, LANDING_STATIC_BRANDS } from "@/lib/landing/contracts";
import { htmlResponse } from "@/lib/landing/http";
import { resolveIremLandingOffer } from "@/lib/landing/offers";
import { prepareLandingHtml } from "@/lib/landing/prepareLandingHtml";
import { renderEntryHtmlDocument } from "@/lib/landing/renderEntryHtmlDocument";
import { isNextLandingEnabled } from "@/lib/landing/routing";
import { resolveStaticLandingProduct } from "@/lib/landing/types";
import { serveStaticAsset } from "@/lib/staticAssets/serve";

export const runtime = "nodejs";
export const revalidate = 3600;

function isEntryAssetPath(assetPath: string[]): boolean {
  return assetPath.length === 0 || (assetPath.length === 1 && assetPath[0] === "index.html");
}

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

export async function GET(req: Request, context: { params: Promise<{ brand: string; path: string[] }> }) {
  const params = await context.params;
  const brand = params.brand;
  const assetPath = params.path ?? [];

  if (!LANDING_STATIC_BRANDS.has(brand)) {
    return new Response("Not found", { status: 404 });
  }

  const staticProduct = resolveStaticLandingProduct(brand);
  if (staticProduct) {
    if (isNextLandingEnabled() && isEntryAssetPath(assetPath)) {
      const offer =
        staticProduct === "irem"
          ? await resolveIremLandingOffer(new URL(req.url).searchParams)
          : null;
      const prepared = await prepareLandingHtml({ product: staticProduct, pageKind: "entry", offer });
      const content = LANDING_CONTENT[staticProduct];
      return htmlResponse(
        renderEntryHtmlDocument({
          product: staticProduct,
          bodyHtml: prepared.bodyHtml,
          offer,
          title: content.title,
          description: content.description,
        }),
        "public, max-age=0, s-maxage=0, must-revalidate"
      );
    }

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
