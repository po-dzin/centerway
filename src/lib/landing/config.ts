import { LANDING_CONTENT } from "@/lib/landing/content";
import type { StaticLandingProduct } from "@/lib/landing/types";

export type LandingRouteConfig = {
  title: string;
  entryPage: "short" | "irem";
  htmlPath: string;
  assetPrefix: "/short" | "/irem";
  assetName: "short" | "irem";
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

export const LANDING_ROUTE_CONFIG: Record<StaticLandingProduct, LandingRouteConfig> = {
  short: {
    title: LANDING_CONTENT.short.title,
    entryPage: "short",
    htmlPath: "short/index.html",
    assetPrefix: "/short",
    assetName: "short",
  },
  irem: {
    title: LANDING_CONTENT.irem.title,
    entryPage: "irem",
    htmlPath: "irem/index.html",
    assetPrefix: "/irem",
    assetName: "irem",
  },
};

export function getLandingEntryPath(product: StaticLandingProduct): `/${LandingRouteConfig["entryPage"]}` {
  return `/${LANDING_ROUTE_CONFIG[product].entryPage}`;
}

export function getLandingPageName(product: StaticLandingProduct): LandingRouteConfig["entryPage"] {
  return LANDING_ROUTE_CONFIG[product].entryPage;
}

export function getLandingShellAssets(product: StaticLandingProduct) {
  const { assetPrefix, assetName } = LANDING_ROUTE_CONFIG[product];
  const styles = [
    `${assetPrefix}/js/themes/simple.css`,
    ...SHARED_STYLES,
    `${assetPrefix}/css/${assetName}.product.css`,
    `${assetPrefix}/css/${assetName}.product.responsive.css`,
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

export function getLandingCriticalCss(product: StaticLandingProduct) {
  const config = LANDING_ROUTE_CONFIG[product];
  const accent = product === "short" ? "#e87d73" : "#4f7e76";
  const accentStrong = product === "short" ? "#cf6a61" : "#1e3d34";
  const badgeBg = product === "short" ? "#fefbbd" : "#eef6ff";
  const badgeText = product === "short" ? "#7a430f" : "#27485f";

  return `
html,body{margin:0;padding:0;background:#fffdf7;color:#2d2d2b}
body{font-family:"Segoe UI",Arial,sans-serif;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}
main[data-cw-page="${config.entryPage}"]{display:block}
.section-hero{background:#fffdf7;padding:0;position:relative;overflow:hidden}
.section-hero .container{max-width:1160px;margin:0 auto;padding:24px 20px 32px;display:grid;grid-template-columns:1fr;gap:24px;align-items:center}
.section-hero .content,.section-hero .hero-text{display:flex;flex-direction:column;gap:16px}
.section-hero h1{margin:0;font-size:32px;line-height:1.06;font-weight:700;color:#2d2d2b}
.section-hero h3,.section-hero h4{margin:0;font-size:20px;line-height:1.45;font-weight:500;color:#2d2d2b}
.section-hero p{margin:0;line-height:1.5}
.section-hero .badge,.section-hero .hero-badge{display:inline-flex;align-items:center;align-self:flex-start;padding:8px 16px;border-radius:999px;background:${badgeBg};color:${badgeText};font-size:14px;font-weight:700;line-height:1}
.benefits__list,.hero-highlights__chips{display:flex;flex-wrap:wrap;gap:10px;padding:0;margin:0;list-style:none}
.benefits__item,.hero-highlights__chips span{display:inline-flex;align-items:center;gap:8px}
#divprice{display:flex;flex-direction:column;align-items:flex-start;gap:12px}
.price{display:flex;flex-direction:column;gap:6px}
.price-stack{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}
.price-old{color:#6e6e6e;font-size:22px;text-decoration:line-through}
.price-current,.price span{color:${accent};font-size:32px;font-weight:700;line-height:1.1}
.price-note-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.openModal{display:inline-flex;align-items:center;justify-content:center;min-height:52px;padding:14px 24px;border:0;border-radius:999px;background:${accent};color:#fff;font-size:16px;font-weight:700;line-height:1.1;text-decoration:none}
[data-sticky-menu]{display:none}
.video-embed{position:relative;display:block;width:100%;aspect-ratio:16/9;border-radius:24px;overflow:hidden;background:#f2f2f0}
.video-embed__button{position:relative;display:block;width:100%;height:100%;padding:0;border:0;background:transparent}
.video-embed__poster-image{display:block;width:100%;height:100%;object-fit:cover}
.video-embed__button::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(20,24,32,.12),rgba(20,24,32,.42))}
.video-embed__play{position:absolute;top:50%;left:50%;width:64px;height:64px;border-radius:50%;transform:translate(-50%,-50%);background:rgba(255,255,255,.92);box-shadow:0 12px 28px rgba(16,16,16,.18)}
.video-embed__play::before{content:"";position:absolute;top:50%;left:50%;transform:translate(-35%,-50%);border-top:12px solid transparent;border-bottom:12px solid transparent;border-left:18px solid ${accentStrong}}
.video-embed__label{position:absolute;left:16px;right:16px;bottom:16px;z-index:1;color:#fff;font-size:13px;font-weight:600;line-height:1.35;text-align:left}
@media (min-width:900px){.section-hero .container{padding:32px 24px 40px;grid-template-columns:minmax(0,1fr) minmax(320px,520px)}.section-hero h1{font-size:56px;line-height:1.02}.section-hero h3,.section-hero h4{font-size:24px;line-height:1.4}.video-embed__play{width:72px;height:72px}}
`;
}
