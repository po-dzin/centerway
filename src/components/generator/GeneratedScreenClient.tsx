"use client";

import type { CSSProperties } from "react";
import type { ResolvedGeneratedScreen } from "@/lib/generator/types";
import { RecipeRenderer } from "@/components/generator/RecipeRenderer";
import { DepthLabToggle } from "@/components/generator/DepthLabToggle";

type GeneratedScreenClientProps = {
  resolved: ResolvedGeneratedScreen;
};

function asCustomPropertyStyle(tokens: Record<`--${string}`, string>): CSSProperties {
  return tokens as unknown as CSSProperties;
}

export function GeneratedScreenClient({ resolved }: GeneratedScreenClientProps) {
  const style = asCustomPropertyStyle(resolved.tokens);
  const showDepthLab =
    resolved.screen.route_key === "consult" ||
    resolved.screen.route_key === "detox" ||
    resolved.screen.route_key === "herbs" ||
    resolved.screen.route_key === "dosha-test";

  return (
    <div
      data-cw-screen-id={resolved.screen.id}
      data-cw-screen-version={resolved.screen.version}
      data-cw-mode={resolved.screen.mode}
      data-cw-branch={resolved.screen.branch}
      data-cw-token-pack={resolved.tokenPackId}
      data-cw-theme={resolved.themeFamily}
      style={style}
    >
      {showDepthLab ? <DepthLabToggle /> : null}
      {resolved.blocks
        .filter((block) => block.block?.render_mode !== "semantic-only")
        .map((block) => (
          <RecipeRenderer
            key={block.id}
            blockId={block.id}
            recipeId={block.recipe.id}
            recipeVersion={block.recipe.version}
            componentKey={block.recipe.component_key}
            semanticBlockType={block.semanticBlock?.block_type}
            semanticFamily={block.semanticBlock?.family}
            props={block.props}
            generatorContext={{
              manifest_id: resolved.screen.id,
              manifest_version: resolved.screen.version,
              mode: resolved.screen.mode,
              branch: resolved.screen.branch,
              experiment_key: resolved.experimentResolution?.experiment_key,
              variant_key: resolved.experimentResolution?.variant_key,
              assignment_source: resolved.experimentResolution?.source,
            }}
          />
        ))}
    </div>
  );
}
