import { LANDING_STATIC_BRANDS } from "@/lib/landing/contracts";

const INFRA_BYPASS_PREFIXES = ["/api/", "/v1/", "/_next/", "/pay/return"] as const;

const LANDING_BRAND_PREFIXES = Array.from(LANDING_STATIC_BRANDS, (brand) => `/${brand}/`);

const BYPASS_EXACT_PATHS = new Set(["/favicon.ico"]);

export function shouldBypassProxy(pathname: string): boolean {
  if (BYPASS_EXACT_PATHS.has(pathname)) {
    return true;
  }

  if (INFRA_BYPASS_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return true;
  }

  return LANDING_BRAND_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}
