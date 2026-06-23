import { NextRequest, NextResponse } from "next/server";
import { getUtilityPageByFile } from "@/lib/landing/contracts";
import {
  getLandingEntryProduct,
  getLandingFallbackPath,
  getLandingRootRewritePath,
  isLandingRootAssetPath,
  isNextLandingEnabled,
} from "@/lib/landing/routing";
import { resolveExperimentAssignmentRoute, withExperimentAssignmentRewrite } from "@/lib/proxy/experiments";
import { resolveRequestBrand } from "@/lib/proxy/requestBrand";
import { CW_SURFACE_KIND_HEADER } from "@/lib/surfaces/headers";
import { getProductSurfaceEntry, isActiveFunnelProduct, type ProductKey } from "@/lib/surfaces/catalog";

export const CW_HOST_UTILITY_REWRITE_HEADER = "x-cw-host-utility-rewrite";

function rewriteSurfaceRoute(req: NextRequest, pathname: string, surfaceKind: "funnel" | "platform") {
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set(CW_SURFACE_KIND_HEADER, surfaceKind);
  const routeKey = resolveExperimentAssignmentRoute(pathname);
  if (routeKey) {
    return withExperimentAssignmentRewrite(req, pathname, routeKey, requestHeaders);
  }

  const url = req.nextUrl.clone();
  url.pathname = pathname;
  return NextResponse.rewrite(url, { request: { headers: requestHeaders } });
}

function rewriteStaticLanding(req: NextRequest, staticPath: string, requestHeaders?: Headers) {
  const url = req.nextUrl.clone();
  url.pathname = staticPath;
  return NextResponse.rewrite(url, requestHeaders ? { request: { headers: requestHeaders } } : undefined);
}

function rewriteDisabledSurface(req: NextRequest) {
  const url = req.nextUrl.clone();
  url.pathname = "/__surface-disabled";
  return NextResponse.rewrite(url);
}

function getLegacyStaticPrefix(product: ProductKey) {
  if (product === "reboot") return "/short";
  if (product === "irem") return "/irem-v2";
  return `/${product}`;
}

function rewriteGeneratedFunnelUtility(req: NextRequest, product: "consult" | "detox", mappedPage: string) {
  const utilityPage = getUtilityPageByFile(mappedPage.replace(/^\//, ""));
  if (!utilityPage) {
    return rewriteDisabledSurface(req);
  }

  return rewriteSurfaceRoute(req, `/funnel-support/${product}/${utilityPage}`, "funnel");
}

export function rewriteLegacyLandingEntryRequest(req: NextRequest): NextResponse | null {
  const product = getLandingEntryProduct(req.nextUrl.pathname);
  if (!product) {
    return null;
  }

  if (isNextLandingEnabled()) {
    return NextResponse.next();
  }

  return rewriteStaticLanding(req, getLandingFallbackPath(product));
}

export function rewriteFunnelHostRequest(req: NextRequest): NextResponse | null {
  const product = resolveRequestBrand(req);
  if (!product) {
    return null;
  }
  const entry = getProductSurfaceEntry(product);

  const mappedPage = getLandingRootRewritePath(req.nextUrl.pathname);
  if (mappedPage) {
    if (product === "mini-detox" && mappedPage === "/index.html") {
      return rewriteSurfaceRoute(req, "/programs/mini-detox", "platform");
    }

    if (!isActiveFunnelProduct(product)) {
      return rewriteDisabledSurface(req);
    }

    if (mappedPage === "/index.html" && entry.internalFunnelRoute) {
      return rewriteSurfaceRoute(req, entry.internalFunnelRoute, "funnel");
    }

    if (entry.funnelRuntime === "landing-app") {
      const requestHeaders = new Headers(req.headers);
      requestHeaders.set(CW_HOST_UTILITY_REWRITE_HEADER, "1");
      return rewriteStaticLanding(req, `${getLegacyStaticPrefix(product)}${mappedPage}`, requestHeaders);
    }

    if (
      entry.funnelRuntime === "generated-app" &&
      (product === "consult" || product === "detox")
    ) {
      return rewriteGeneratedFunnelUtility(req, product, mappedPage);
    }

    return rewriteDisabledSurface(req);
  }

  if (isLandingRootAssetPath(req.nextUrl.pathname)) {
    if (entry.funnelRuntime === "landing-app") {
      return rewriteStaticLanding(req, `${getLegacyStaticPrefix(product)}${req.nextUrl.pathname}`);
    }
    return rewriteDisabledSurface(req);
  }

  return rewriteDisabledSurface(req);
}
