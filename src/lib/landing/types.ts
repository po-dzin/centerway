export type LandingProduct = "short" | "irem";
export type StaticLandingProduct = "short" | "irem";

const STATIC_LANDING_PRODUCT_ALIASES: Record<string, StaticLandingProduct> = {
  short: "short",
  reboot: "short",
  irem: "irem",
};

export function resolveStaticLandingProduct(value: string): StaticLandingProduct | null {
  return STATIC_LANDING_PRODUCT_ALIASES[value] ?? null;
}
