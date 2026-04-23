import type { ScreenRouteKey } from "@/lib/generator/types";

export const AUTH_REQUIRED_ROUTE_KEYS: ScreenRouteKey[] = [];

export function isAuthRequiredRoute(routeKey: ScreenRouteKey): boolean {
  return AUTH_REQUIRED_ROUTE_KEYS.includes(routeKey);
}
