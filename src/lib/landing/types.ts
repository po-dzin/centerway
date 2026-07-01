export type LandingProduct = "short" | "irem";
export type StaticLandingProduct = "short" | "irem";

const LANDING_PRODUCTS = new Set<LandingProduct>(["short", "irem"]);
const STATIC_LANDING_PRODUCTS = new Set<StaticLandingProduct>(["short", "irem"]);
const STATIC_LANDING_PRODUCT_ALIASES: Record<string, StaticLandingProduct> = {
  short: "short",
  reboot: "short",
  irem: "irem",
};

export function isLandingProduct(value: string): value is LandingProduct {
  return LANDING_PRODUCTS.has(value as LandingProduct);
}

export function isStaticLandingProduct(value: string): value is StaticLandingProduct {
  return STATIC_LANDING_PRODUCTS.has(value as StaticLandingProduct);
}

export function resolveStaticLandingProduct(value: string): StaticLandingProduct | null {
  return STATIC_LANDING_PRODUCT_ALIASES[value] ?? null;
}
