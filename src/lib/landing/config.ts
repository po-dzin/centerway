import { LANDING_CONTENT } from "@/lib/landing/content";
import type { LandingProduct } from "@/lib/landing/types";

export type LandingRouteConfig = {
  title: string;
  entryPage: "reboot" | "irem";
  htmlPath: string;
  assetPrefix: `/${LandingProduct}`;
};

const SHARED_STYLES = [
  "/shared/css/tokens.css",
  "/shared/css/foundation.css",
  "/shared/css/pages.css",
  "/shared/css/landing.bridge.css",
];

const SHARED_SCRIPTS = [
  "/shared/js/landing-pixel.js",
  "/shared/js/landing-runtime.js",
];

export const LANDING_ROUTE_CONFIG: Record<LandingProduct, LandingRouteConfig> = {
  short: {
    title: LANDING_CONTENT.short.title,
    entryPage: "reboot",
    htmlPath: "short/index.html",
    assetPrefix: "/short",
  },
  irem: {
    title: LANDING_CONTENT.irem.title,
    entryPage: "irem",
    htmlPath: "irem/index.html",
    assetPrefix: "/irem",
  },
};

export function getLandingEntryPath(product: LandingProduct): `/${LandingRouteConfig["entryPage"]}` {
  return `/${LANDING_ROUTE_CONFIG[product].entryPage}`;
}

export function getLandingPageName(product: LandingProduct): LandingRouteConfig["entryPage"] {
  return LANDING_ROUTE_CONFIG[product].entryPage;
}

export function getLandingShellAssets(product: LandingProduct) {
  const { assetPrefix } = LANDING_ROUTE_CONFIG[product];
  const styles = [
    "https://fonts.googleapis.com/css2?family=Open+Sans:ital,wght@0,300..800;1,300..800&display=swap",
    `${assetPrefix}/js/themes/simple.css`,
    `${assetPrefix}/css/fonts.css`,
    ...SHARED_STYLES,
    `${assetPrefix}/css/${product}.product.css`,
    `${assetPrefix}/css/${product}.product.responsive.css`,
  ];

  const scripts = [
    `${assetPrefix}/js/lazysizes.min.js`,
    `${assetPrefix}/js/common.js`,
  ];

  return {
    styles,
    scripts,
    pixelScript: SHARED_SCRIPTS[0],
    runtimeScript: SHARED_SCRIPTS[1],
    bridgeStylesheet: SHARED_STYLES[3],
  };
}
