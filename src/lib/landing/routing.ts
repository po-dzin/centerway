import { getLandingEntryPath, LANDING_ROUTE_CONFIG } from "@/lib/landing/config";
import {
  LANDING_ASSET_PREFIXES,
  LANDING_ROOT_FILES,
  ROOT_LANDING_PAGE_MAP,
} from "@/lib/landing/contracts";
import type { StaticLandingProduct } from "@/lib/landing/types";

export function normalizeLandingPathname(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }
  return pathname;
}

export function getLandingRootRewritePath(pathname: string): string | null {
  return ROOT_LANDING_PAGE_MAP[pathname] ?? null;
}

export function isLandingRootAssetPath(pathname: string): boolean {
  return LANDING_ASSET_PREFIXES.some((prefix) => pathname.startsWith(prefix)) || LANDING_ROOT_FILES.has(pathname);
}

export function getLandingEntryProduct(pathname: string): StaticLandingProduct | null {
  const normalizedPathname = normalizeLandingPathname(pathname);

  for (const product of Object.keys(LANDING_ROUTE_CONFIG) as StaticLandingProduct[]) {
    if (normalizedPathname === getLandingEntryPath(product)) {
      return product;
    }
  }

  return null;
}

export function getLandingFallbackPath(product: StaticLandingProduct): string {
  return `${LANDING_ROUTE_CONFIG[product].assetPrefix}/index.html`;
}

export function isNextLandingEnabled(): boolean {
  const raw = (process.env.CW_NEXT_LANDING_SHORT_IREM ?? "1").trim().toLowerCase();
  return raw !== "0" && raw !== "false" && raw !== "off";
}
