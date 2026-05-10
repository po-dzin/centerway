import { headers } from "next/headers";
import { decodeExperimentAssignmentsHeader, CW_EXPERIMENT_ASSIGNMENTS_HEADER } from "@/lib/experiments/engine";
import { resolveScreenForRoute } from "@/lib/generator/resolve";
import { resolveRouteRuntime } from "@/lib/generator/routeRuntime";
import type { ScreenRouteKey } from "@/lib/generator/types";
import { GeneratedScreenClient } from "@/components/generator/GeneratedScreenClient";
import { CW_THEME_SELECTION_HEADER } from "@/lib/generator/theme";
import { CW_SURFACE_KIND_HEADER } from "@/lib/surfaces/headers";
import type { SurfaceKind } from "@/lib/surfaces/catalog";

type GeneratedRouteScreenProps = {
  routeKey: ScreenRouteKey;
};

export async function GeneratedRouteScreen({ routeKey }: GeneratedRouteScreenProps) {
  const headerStore = await headers();
  const assignments = decodeExperimentAssignmentsHeader(headerStore.get(CW_EXPERIMENT_ASSIGNMENTS_HEADER));
  const themeSelection = headerStore.get(CW_THEME_SELECTION_HEADER);
  const requestedSurfaceKind = (headerStore.get(CW_SURFACE_KIND_HEADER) as SurfaceKind | null) ?? undefined;
  const resolved = resolveScreenForRoute(routeKey, assignments, { themeSelection });
  const cssHrefs = resolveRouteRuntime(routeKey, requestedSurfaceKind).cssHrefs ?? [];

  return (
    <>
      {cssHrefs.map((href) => <link key={href} rel="stylesheet" href={href} />)}
      <GeneratedScreenClient resolved={resolved} requestedSurfaceKind={requestedSurfaceKind} />
    </>
  );
}
