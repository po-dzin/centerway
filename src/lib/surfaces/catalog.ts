export type ProductKey = "reboot" | "irem" | "mini-detox" | "detox" | "herbs" | "consult";
export type SurfaceKind = "funnel" | "platform" | "utility";
export type CtaMode = "lead" | "checkout" | "redirect";
export type FunnelRuntime = "landing-app" | "generated-app" | "disabled";

export type ProductSurfaceEntry = {
  productKey: ProductKey;
  surfaceKinds: SurfaceKind[];
  host: string | null;
  platformRoute: string | null;
  ctaMode: CtaMode;
  defaultDoshaEligibility: "primary" | "secondary" | "none";
  status: "active" | "planned" | "disabled";
  funnelRuntime: FunnelRuntime;
  internalFunnelRoute: string | null;
  legacyAliases?: string[];
};

const PRODUCT_SURFACE_REGISTRY: Record<ProductKey, ProductSurfaceEntry> = {
  reboot: {
    productKey: "reboot",
    surfaceKinds: ["funnel", "platform"],
    host: "reboot.centerway.net.ua",
    platformRoute: "/programs/reboot",
    ctaMode: "checkout",
    defaultDoshaEligibility: "none",
    status: "active",
    funnelRuntime: "landing-app",
    internalFunnelRoute: "/reboot",
    legacyAliases: ["short"],
  },
  irem: {
    productKey: "irem",
    surfaceKinds: ["funnel", "platform"],
    host: "irem.centerway.net.ua",
    platformRoute: "/programs/irem",
    ctaMode: "checkout",
    defaultDoshaEligibility: "none",
    status: "active",
    funnelRuntime: "landing-app",
    internalFunnelRoute: "/irem",
  },
  "mini-detox": {
    productKey: "mini-detox",
    surfaceKinds: ["funnel", "platform"],
    host: "mini-detox.centerway.net.ua",
    platformRoute: "/programs/mini-detox",
    ctaMode: "redirect",
    defaultDoshaEligibility: "none",
    status: "active",
    funnelRuntime: "generated-app",
    internalFunnelRoute: "/mini-detox",
  },
  detox: {
    productKey: "detox",
    surfaceKinds: ["funnel", "platform"],
    host: "detox.centerway.net.ua",
    platformRoute: "/programs/detox",
    ctaMode: "lead",
    defaultDoshaEligibility: "secondary",
    status: "active",
    funnelRuntime: "generated-app",
    internalFunnelRoute: "/detox",
  },
  herbs: {
    productKey: "herbs",
    surfaceKinds: ["funnel", "platform"],
    host: "herbs.centerway.net.ua",
    platformRoute: "/products/herbs",
    ctaMode: "redirect",
    defaultDoshaEligibility: "secondary",
    status: "active",
    funnelRuntime: "generated-app",
    internalFunnelRoute: "/herbs",
  },
  consult: {
    productKey: "consult",
    surfaceKinds: ["funnel", "platform"],
    host: "consult.centerway.net.ua",
    platformRoute: "/consult",
    ctaMode: "lead",
    defaultDoshaEligibility: "primary",
    status: "active",
    funnelRuntime: "generated-app",
    internalFunnelRoute: "/consult",
  },
};

const HOST_TO_PRODUCT = new Map<string, ProductKey>();

for (const entry of Object.values(PRODUCT_SURFACE_REGISTRY)) {
  if (!entry.host) continue;
  HOST_TO_PRODUCT.set(entry.host, entry.productKey);
  HOST_TO_PRODUCT.set(`www.${entry.host}`, entry.productKey);
}

function normalizeHost(raw: string | null): string {
  if (!raw) return "";
  return raw.split(":")[0].trim().toLowerCase();
}

export function getProductSurfaceRegistry() {
  return PRODUCT_SURFACE_REGISTRY;
}

export function getProductSurfaceEntry(productKey: ProductKey): ProductSurfaceEntry {
  return PRODUCT_SURFACE_REGISTRY[productKey];
}

export function getProductKeyByAlias(input: string | null | undefined): ProductKey | null {
  if (!input) return null;
  const normalized = input.trim().toLowerCase();
  for (const entry of Object.values(PRODUCT_SURFACE_REGISTRY)) {
    if (entry.productKey === normalized) return entry.productKey;
    if (entry.legacyAliases?.includes(normalized)) return entry.productKey;
  }
  return null;
}

export function getProductByHost(rawHost: string | null): ProductKey | null {
  return HOST_TO_PRODUCT.get(normalizeHost(rawHost)) ?? null;
}

export function isActiveFunnelProduct(productKey: ProductKey): boolean {
  const entry = getProductSurfaceEntry(productKey);
  return entry.surfaceKinds.includes("funnel") && entry.status === "active" && entry.funnelRuntime !== "disabled";
}

export function getFunnelHostUrl(productKey: ProductKey): string | null {
  const host = getProductSurfaceEntry(productKey).host;
  return host ? `https://${host}/` : null;
}

export function getPlatformRoute(productKey: ProductKey): string | null {
  return getProductSurfaceEntry(productKey).platformRoute;
}

export function getMainDomainSitemapRoutes(): string[] {
  return [
    "/",
    "/programs",
    "/products",
    "/expert",
    "/programs/reboot",
    "/programs/detox",
    "/products/herbs",
    "/programs/ideal-body",
    "/programs/irem",
    "/programs/mini-detox",
    "/consult",
    "/herbs",
    "/dosha-test",
    "/legal/public-offer",
    "/legal/privacy",
  ];
}
