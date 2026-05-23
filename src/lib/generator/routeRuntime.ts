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
    shell: "platform",
    platformHeaderMode: "overlay",
  },
  detox: {
    defaultScreenId: "screen.detox.v1.control",
    cssHrefs: [REVORK_STYLESHEET],
    shell: "platform",
    platformHeaderMode: "overlay",
  },
  herbs: {
    defaultScreenId: "screen.herbs.v1.control",
    cssHrefs: [REVORK_STYLESHEET],
    shell: "platform",
    platformHeaderMode: "overlay",
  },
  "dosha-test": {
    defaultScreenId: "screen.dosha-test.v1.control",
    cssHrefs: [REVORK_STYLESHEET],
    shell: "platform",
    platformHeaderMode: "overlay",
  },
  "lesson-pilot": {
    defaultScreenId: "screen.lesson.pilot.v1.control",
    cssHrefs: [REVORK_STYLESHEET],
    shell: "plain",
  },
  "platform-home": {
    defaultScreenId: "screen.platform-home.v1.control",
    shell: "platform",
    platformHeaderMode: "overlay",
  },
  expert: {
    defaultScreenId: "screen.expert.v1.control",
    shell: "platform",
    platformHeaderMode: "overlay",
  },
  "program-way21": {
    defaultScreenId: "screen.program-way21.v1.control",
    shell: "platform",
    platformHeaderMode: "overlay",
  },
  "program-ideal-body": {
    defaultScreenId: "screen.program-ideal-body.v1.control",
    shell: "platform",
    platformHeaderMode: "overlay",
  },
  "program-irem": {
    defaultScreenId: "screen.program-irem.v1.control",
    shell: "platform",
    platformHeaderMode: "overlay",
  },
  "program-reboot": {
    defaultScreenId: "screen.program-reboot.v1.control",
    shell: "platform",
    platformHeaderMode: "overlay",
  },
  "mini-detox": {
    defaultScreenId: "screen.mini-detox.v1.control",
    shell: "platform",
    platformHeaderMode: "overlay",
  },
};

export function getRouteRuntime(routeKey: ScreenRouteKey): RouteRuntimeConfig {
  return ROUTE_RUNTIME[routeKey];
}

export function resolveRouteRuntime(routeKey: ScreenRouteKey, surfaceKind?: SurfaceKind): RouteRuntimeConfig {
  const base = getRouteRuntime(routeKey);

  if (surfaceKind !== "funnel") {
    return base;
  }

  if (routeKey === "consult" || routeKey === "detox" || routeKey === "herbs") {
    return {
      ...base,
      shell: "plain",
      stickyFooter: true,
    };
  }

  if (routeKey === "mini-detox") {
    return {
      ...base,
      shell: "plain",
      platformHeaderMode: undefined,
    };
  }

  return base;
}

export function isStickyFooterRoute(routeKey: ScreenRouteKey): routeKey is StickyFooterRouteKey {
  return routeKey === "consult" || routeKey === "detox" || routeKey === "herbs";
}

export function resolveEffectiveRouteMetadata(routeKey: ScreenRouteKey, surfaceKind?: SurfaceKind): EffectiveRouteMetadata {
  if (surfaceKind === "funnel") {
    return {
      routeFamily: "funnel surface",
      routeBoundary: "isolated funnel route",
      surfaceKind: "funnel",
    };
  }

  if (routeKey === "lesson-pilot") {
    return {
      routeFamily: "utility",
      routeBoundary: "platform utility route",
      surfaceKind: "utility",
    };
  }

  if (routeKey === "dosha-test") {
    return {
      routeFamily: "standalone route entry",
      routeBoundary: "platform route",
      surfaceKind: "platform",
    };
  }

  if (routeKey === "consult" || routeKey === "detox" || routeKey === "herbs") {
    return {
      routeFamily: "standalone route entry",
      routeBoundary: "platform route",
      surfaceKind: "platform",
    };
  }

  if (routeKey === "platform-home") {
    return {
      routeFamily: "platform hub",
      routeBoundary: "platform route",
      surfaceKind: "platform",
    };
  }

  if (routeKey === "expert") {
    return {
      routeFamily: "expert",
      routeBoundary: "platform route",
      surfaceKind: "platform",
    };
  }

  if (routeKey === "program-way21" || routeKey === "program-ideal-body" || routeKey === "program-irem") {
    return {
      routeFamily: "program offer",
      routeBoundary: "platform route",
      surfaceKind: "platform",
    };
  }

  if (routeKey === "program-reboot" || routeKey === "mini-detox") {
    return {
      routeFamily: "mini-course offer",
      routeBoundary: "platform route",
      surfaceKind: "platform",
    };
  }

  return {
    routeFamily: "standalone route entry",
    routeBoundary: "platform route",
    surfaceKind: "platform",
  };
}
