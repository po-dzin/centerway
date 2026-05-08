export type LandingProduct = "reboot" | "irem" | "mini-detox" | "detox" | "consult";
export type StaticLandingProduct = "reboot" | "irem";

const LANDING_PRODUCTS = new Set<LandingProduct>(["reboot", "irem", "mini-detox", "detox", "consult"]);
const STATIC_LANDING_PRODUCTS = new Set<StaticLandingProduct>(["reboot", "irem"]);

export function isLandingProduct(value: string): value is LandingProduct {
  return LANDING_PRODUCTS.has(value as LandingProduct);
}

export function isStaticLandingProduct(value: string): value is StaticLandingProduct {
  return STATIC_LANDING_PRODUCTS.has(value as StaticLandingProduct);
}
