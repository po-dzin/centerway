import { NextRequest, NextResponse } from "next/server";
import {
  getLandingEntryProduct,
  getLandingFallbackPath,
  getLandingRootRewritePath,
  isLandingRootAssetPath,
  isNextLandingEnabled,
} from "@/lib/landing/routing";
import { resolveRequestBrand } from "@/lib/proxy/requestBrand";

function rewriteLanding(req: NextRequest, landingPath: string) {
  const brand = resolveRequestBrand(req);
  if (!brand) {
    return null;
  }

  const url = req.nextUrl.clone();
  url.pathname = `/${brand}${landingPath}`;
  return NextResponse.rewrite(url);
}

export function maybeHandleLandingEntry(req: NextRequest): NextResponse | null {
  const product = getLandingEntryProduct(req.nextUrl.pathname);
  if (!product) {
    return null;
  }

  if (isNextLandingEnabled()) {
    return NextResponse.next();
  }

  const url = req.nextUrl.clone();
  url.pathname = getLandingFallbackPath(product);
  return NextResponse.rewrite(url);
}

export function maybeRewriteLandingRequest(req: NextRequest): NextResponse | null {
  const mappedPage = getLandingRootRewritePath(req.nextUrl.pathname);
  if (mappedPage) {
    return rewriteLanding(req, mappedPage);
  }

  if (isLandingRootAssetPath(req.nextUrl.pathname)) {
    return rewriteLanding(req, req.nextUrl.pathname);
  }

  return null;
}
