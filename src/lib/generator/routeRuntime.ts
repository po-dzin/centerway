import { findScreenManifestById } from "@/lib/generator/registry";
import type { RouteFamily, ScreenRouteKey } from "@/lib/generator/types";
import type { SurfaceKind } from "@/lib/surfaces/catalog";

export type RouteShellMode = "platform" | "plain";
export type PlatformHeaderMode = "overlay" | "default";
export type StickyFooterRouteKey = "consult" | "detox" | "herbs";

type RouteRuntimeConfig = {
  defaultScreenId: string;
  cssHrefs?: string[];
  shell: RouteShellMode;
  platformHeaderMode?: PlatformHeaderMode;
  stickyFooter?: boolean;
};

type EffectiveRouteMetadata = {
  routeFamily: RouteFamily;
  routeBoundary: string;
  surfaceKind: SurfaceKind;
};

const REVORK_STYLESHEET = "/cw/landing/revork.css";

const ROUTE_RUNTIME: Record<ScreenRouteKey, RouteRuntimeConfig> = {
  consult: {
    defaultScreenId: "screen.consult.v1.control",
    cssHrefs: [REVORK_STYLESHEET],
    shell: "plain",
    stickyFooter: true,
  },
  detox: {
    defaultScreenId: "screen.detox.v1.control",
    cssHrefs: [REVORK_STYLESHEET],
    shell: "plain",
    stickyFooter: true,
  },
  herbs: {
    defaultScreenId: "screen.herbs.v1.control",
    cssHrefs: [REVORK_STYLESHEET],
    shell: "plain",
    stickyFooter: true,
  },
  "lesson-pilot": {
    defaultScreenId: "screen.lesson.pilot.v1.control",
    cssHrefs: [REVORK_STYLESHEET],
    shell: "plain",
  },
};

export function getRouteRuntime(routeKey: ScreenRouteKey): RouteRuntimeConfig {
  return ROUTE_RUNTIME[routeKey];
}

export function resolveRouteRuntime(routeKey: ScreenRouteKey): RouteRuntimeConfig {
  return getRouteRuntime(routeKey);
}

export function isStickyFooterRoute(routeKey: ScreenRouteKey): routeKey is StickyFooterRouteKey {
  return routeKey === "consult" || routeKey === "detox" || routeKey === "herbs";
}

function surfaceKindFromRouteFamily(routeFamily: RouteFamily): SurfaceKind {
  return routeFamily === "utility" ? "utility" : "funnel";
}

export function resolveEffectiveRouteMetadata(routeKey: ScreenRouteKey): EffectiveRouteMetadata {
  const runtime = getRouteRuntime(routeKey);
  const screen = findScreenManifestById(runtime.defaultScreenId);

  if (screen) {
    return {
      routeFamily: screen.route_family,
      routeBoundary: screen.route_boundary,
      surfaceKind: surfaceKindFromRouteFamily(screen.route_family),
    };
  }

  return {
    routeFamily: routeKey === "lesson-pilot" ? "utility" : "funnel surface",
    routeBoundary: routeKey === "lesson-pilot" ? "platform utility route" : "isolated funnel route",
    surfaceKind: routeKey === "lesson-pilot" ? "utility" : "funnel",
  };
}
