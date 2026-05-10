"use client";

import type { CSSProperties } from "react";
import type { ResolvedGeneratedScreen } from "@/lib/generator/types";
import { RecipeRenderer } from "@/components/generator/RecipeRenderer";
import { DepthLabToggle } from "@/components/generator/DepthLabToggle";
import { FunnelFooterSticky } from "@/components/landing/revork/FunnelSections";
import { RouteAuthGate } from "@/components/auth/RouteAuthGate";
import { isAuthRequiredRoute } from "@/lib/auth/protectedRoutes";
import { PlatformShell } from "@/components/platform/PlatformLayout";
import { isStickyFooterRoute, resolveEffectiveRouteMetadata, resolveRouteRuntime } from "@/lib/generator/routeRuntime";
import type { SurfaceKind } from "@/lib/surfaces/catalog";

type GeneratedScreenClientProps = {
  resolved: ResolvedGeneratedScreen;
  requestedSurfaceKind?: SurfaceKind;
};

function asCustomPropertyStyle(tokens: Record<`--${string}`, string>): CSSProperties {
  return tokens as unknown as CSSProperties;
}

export function GeneratedScreenClient({ resolved, requestedSurfaceKind }: GeneratedScreenClientProps) {
  const style = asCustomPropertyStyle(resolved.tokens);
  const routeKey = resolved.screen.route_key;
  const routeRuntime = resolveRouteRuntime(routeKey, requestedSurfaceKind);
  const showDepthLab = routeRuntime.stickyFooter === true;
  const effectiveRouteMetadata = resolveEffectiveRouteMetadata(routeKey, requestedSurfaceKind);

  const content = (
    <div
      data-cw-screen-id={resolved.screen.id}
      data-cw-screen-version={resolved.screen.version}
      data-cw-mode={resolved.screen.mode}
      data-cw-branch={resolved.screen.branch}
      data-cw-route-family={effectiveRouteMetadata.routeFamily}
      data-cw-route-boundary={effectiveRouteMetadata.routeBoundary}
      data-cw-surface-kind={effectiveRouteMetadata.surfaceKind}
      data-cw-token-pack={resolved.tokenPackId}
      data-cw-theme={resolved.themeFamily}
      style={style}
    >
      {showDepthLab ? <DepthLabToggle /> : null}
      {resolved.blocks
        .filter((block) => block.block?.render_mode !== "semantic-only")
        .map((block) => (
          <div key={block.id} data-cw-block-manifest-id={block.block?.id ?? ""}>
            <RecipeRenderer
              blockId={block.id}
              recipeId={block.recipe.id}
              recipeVersion={block.recipe.version}
              componentKey={block.recipe.component_key}
              semanticBlockType={block.semanticBlock?.block_type}
              semanticFamily={block.block?.semantic_family ?? block.semanticBlock?.family}
              semanticRole={block.block?.semantic_role}
              userQuestion={block.block?.user_question}
              routeBoundary={block.block?.route_boundary}
              renderer={block.block?.renderer}
              props={block.props}
              generatorContext={{
                manifest_id: resolved.screen.id,
                manifest_version: resolved.screen.version,
                mode: resolved.screen.mode,
                branch: resolved.screen.branch,
                experiment_key: resolved.experimentAssignment?.experiment_key,
                variant_key: resolved.experimentAssignment?.variant_key,
                assignment_source: resolved.experimentAssignment?.source,
              }}
            />
          </div>
        ))}
      {routeRuntime.stickyFooter && isStickyFooterRoute(routeKey) ? <FunnelFooterSticky route={routeKey} /> : null}
    </div>
  );

  const wrappedContent = routeRuntime.shell === "platform" ? (
    <PlatformShell headerMode={routeRuntime.platformHeaderMode ?? "default"}>{content}</PlatformShell>
  ) : (
    content
  );

  if (!isAuthRequiredRoute(routeKey)) return wrappedContent;
  return <RouteAuthGate routeKey={routeKey}>{wrappedContent}</RouteAuthGate>;
}
