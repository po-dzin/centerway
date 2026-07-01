import { NextRequest, NextResponse } from "next/server";
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
  const routeKey = resolveExperimentAssignmentRoute();
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
  if (product === "irem") return "/irem";
  return `/${product}`;
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

  if (product === "dosha" && req.nextUrl.pathname.startsWith("/dosha-test")) {
    return rewriteSurfaceRoute(req, "/dosha-test", "platform");
  }

  const mappedPage = getLandingRootRewritePath(req.nextUrl.pathname);
  if (mappedPage) {
    if (!isActiveFunnelProduct(product)) {
      return rewriteDisabledSurface(req);
    }

    if (entry.funnelRuntime === "landing-app") {
      const requestHeaders = new Headers(req.headers);
      requestHeaders.set(CW_HOST_UTILITY_REWRITE_HEADER, "1");
      return rewriteStaticLanding(req, `${getLegacyStaticPrefix(product)}${mappedPage}`, requestHeaders);
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
