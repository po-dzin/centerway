export type ProductKey =
  | "reboot"
  | "irem"
  | "mini-detox"
  | "detox"
  | "way21"
  | "reset-day"
  | "dosha"
  | "herbs"
  | "consult";
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
    legacyAliases: ["short", "reboot"],
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
    surfaceKinds: ["platform"],
    host: null,
    platformRoute: "/programs/mini-detox",
    ctaMode: "redirect",
    defaultDoshaEligibility: "none",
    status: "disabled",
    funnelRuntime: "disabled",
    internalFunnelRoute: null,
  },
  detox: {
    productKey: "detox",
    surfaceKinds: ["platform"],
    host: null,
    platformRoute: "/programs/way21",
    ctaMode: "lead",
    defaultDoshaEligibility: "secondary",
    status: "disabled",
    funnelRuntime: "disabled",
    internalFunnelRoute: null,
  },
  way21: {
    productKey: "way21",
    surfaceKinds: ["funnel"],
    host: "way21.centerway.net.ua",
    platformRoute: "/programs/way21",
    ctaMode: "checkout",
    defaultDoshaEligibility: "none",
    status: "active",
    funnelRuntime: "landing-app",
    internalFunnelRoute: "/way21",
    legacyAliases: ["way21", "shlyah21", "detox", "detox21"],
  },
  "reset-day": {
    productKey: "reset-day",
    surfaceKinds: ["funnel"],
    host: "resetday.centerway.net.ua",
    platformRoute: null,
    ctaMode: "checkout",
    defaultDoshaEligibility: "none",
    status: "active",
    funnelRuntime: "landing-app",
    internalFunnelRoute: "/reset-day",
    legacyAliases: ["reset-day", "resetday", "rozvantazhennya", "mini-detox", "mini_detox", "reset"],
  },
  dosha: {
    productKey: "dosha",
    surfaceKinds: ["funnel", "platform"],
    host: "dosha.centerway.net.ua",
    platformRoute: "/dosha-test",
    ctaMode: "redirect",
    defaultDoshaEligibility: "none",
    status: "active",
    funnelRuntime: "landing-app",
    internalFunnelRoute: "/dosha-test",
    legacyAliases: ["dosha", "dosha-test"],
  },
  herbs: {
    productKey: "herbs",
    surfaceKinds: ["funnel", "platform"],
    host: "herbs.centerway.net.ua",
    platformRoute: "/products/herbs",
    ctaMode: "redirect",
    defaultDoshaEligibility: "secondary",
    status: "active",
    funnelRuntime: "landing-app",
    internalFunnelRoute: "/herbs/index.html",
  },
  consult: {
    productKey: "consult",
    surfaceKinds: ["funnel", "platform"],
    host: "consult.centerway.net.ua",
    platformRoute: "/consult",
    ctaMode: "lead",
    defaultDoshaEligibility: "primary",
    status: "active",
    funnelRuntime: "landing-app",
    internalFunnelRoute: "/consult/index.html",
  },
};

const HOST_TO_PRODUCT = new Map<string, ProductKey>();
const ALIAS_TO_PRODUCT = new Map<string, ProductKey>();

for (const entry of Object.values(PRODUCT_SURFACE_REGISTRY)) {
  if (!entry.host) continue;
  HOST_TO_PRODUCT.set(entry.host, entry.productKey);
  HOST_TO_PRODUCT.set(`www.${entry.host}`, entry.productKey);
}

for (const entry of Object.values(PRODUCT_SURFACE_REGISTRY)) {
  if (entry.status === "active") {
    ALIAS_TO_PRODUCT.set(entry.productKey, entry.productKey);
  }
  for (const alias of entry.legacyAliases ?? []) {
    ALIAS_TO_PRODUCT.set(alias, entry.productKey);
  }
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
  return ALIAS_TO_PRODUCT.get(normalized) ?? null;
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
    "/programs/way21",
    "/products/herbs",
    "/programs/ideal-body",
    "/programs/irem",
    "/consult",
    "/dosha-test",
    "/legal/public-offer",
    "/legal/privacy",
  ];
}
