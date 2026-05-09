export type LandingProduct = "reboot" | "irem" | "mini-detox" | "detox" | "consult";
export type StaticLandingProduct = "reboot" | "irem";

const LANDING_PRODUCTS = new Set<LandingProduct>(["reboot", "irem", "mini-detox", "detox", "consult"]);
const STATIC_LANDING_PRODUCTS = new Set<StaticLandingProduct>(["reboot", "irem"]);
const STATIC_LANDING_PRODUCT_ALIASES: Record<string, StaticLandingProduct> = {
  short: "reboot",
  reboot: "reboot",
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
