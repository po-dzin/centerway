export type LandingProduct = "short" | "irem";

const LANDING_PRODUCTS = new Set<LandingProduct>(["short", "irem"]);

export function isLandingProduct(value: string): value is LandingProduct {
  return LANDING_PRODUCTS.has(value as LandingProduct);
}
