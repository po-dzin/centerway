import { LANDING_STATIC_BRANDS } from "@/lib/landing/contracts";

// "/cw/" and "/shared/" are platform asset roots served straight from static output.
// They must never enter brand resolution: an asset request carries the embedding page
// as its referer, so a page whose path maps to a funnel brand (/consult, /dosha-test,
// /tests/dosha) turned its own images into disabled-surface 404s.
const INFRA_BYPASS_PREFIXES = [
  "/api/",
  "/v1/",
  "/_next/",
  "/_vercel/",
  "/pay/return",
  "/go/",
  "/cw/",
  "/shared/",
] as const;

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
