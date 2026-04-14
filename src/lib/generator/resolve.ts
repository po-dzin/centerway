import {
  findBlockManifestById,
  findBranchOverlayById,
  findModePackById,
  findRecipeById,
  findSemanticBlockById,
  findScreenManifestById,
  findTokenPackById,
  getTokenPacks,
  getExperiments,
  getScreenManifests,
} from "@/lib/generator/registry";
import { resolveTokenPackFromSelection } from "@/lib/generator/theme";
import type {
  ExperimentResolution,
  ResolvedGeneratedScreen,
  ScreenManifest,
  ScreenRouteKey,
} from "@/lib/generator/types";

const DEFAULT_SCREEN_BY_ROUTE: Record<ScreenRouteKey, string> = {
  consult: "screen.consult.v1.control",
  detox: "screen.detox.v1.control",
  herbs: "screen.herbs.v1.control",
  "dosha-test": "screen.dosha-test.v1.control",
  "lesson-pilot": "screen.lesson.pilot.v1.control",
};

function mergeTokens(...sources: Array<Record<`--${string}`, string> | null>): Record<`--${string}`, string> {
  const out: Record<`--${string}`, string> = {};
  for (const source of sources) {
    if (!source) continue;
    for (const [key, value] of Object.entries(source)) {
      out[key as `--${string}`] = value;
    }
  }
  return out;
}

function findRouteExperiment(routeKey: ScreenRouteKey): ReturnType<typeof getExperiments>[number] | null {
  const active = getExperiments().filter((experiment) => experiment.status === "active" && experiment.route_key === routeKey);
  return active[0] ?? null;
}

function findFallbackScreenByRoute(routeKey: ScreenRouteKey): ScreenManifest | null {
  const byDefaultId = findScreenManifestById(DEFAULT_SCREEN_BY_ROUTE[routeKey]);
  if (byDefaultId) return byDefaultId;

  const byRoute = getScreenManifests().find((manifest) => manifest.route_key === routeKey);
  return byRoute ?? null;
}

export function resolveScreenForRoute(
  routeKey: ScreenRouteKey,
  assignments: Record<string, ExperimentResolution>,
  options?: { themeSelection?: string | null }
): ResolvedGeneratedScreen {
  const routeExperiment = findRouteExperiment(routeKey);

  let selectedScreenManifest: ScreenManifest | null = null;
  let experimentResolution: ExperimentResolution | undefined;

  if (routeExperiment) {
    const assignment = assignments[routeExperiment.key];
    if (assignment) {
      const variant = routeExperiment.variants.find((item) => item.key === assignment.variant_key);
      if (variant) {
        const candidateScreen = findScreenManifestById(variant.screen_manifest_id);
        if (candidateScreen) {
          selectedScreenManifest = candidateScreen;
          experimentResolution = assignment;
        }
      }
    }
  }

  if (!selectedScreenManifest) {
    selectedScreenManifest = findFallbackScreenByRoute(routeKey);
  }

  if (!selectedScreenManifest) {
    throw new Error(`screen_manifest_not_found_for_route:${routeKey}`);
  }

  const defaultTokenPack = findTokenPackById(selectedScreenManifest.token_pack_id);
  const modePack = findModePackById(selectedScreenManifest.mode_pack_id);
  const branchOverlay = findBranchOverlayById(selectedScreenManifest.branch_overlay_id);

  if (!defaultTokenPack) throw new Error(`token_pack_not_found:${selectedScreenManifest.token_pack_id}`);
  if (!modePack) throw new Error(`mode_pack_not_found:${selectedScreenManifest.mode_pack_id}`);
  if (!branchOverlay) throw new Error(`branch_overlay_not_found:${selectedScreenManifest.branch_overlay_id}`);
  const tokenPack = resolveTokenPackFromSelection({
    defaultTokenPack,
    tokenPacks: getTokenPacks(),
    explicitSelection: options?.themeSelection,
    assignments,
  });

  const blocks = selectedScreenManifest.blocks.map((block) => {
    const blockManifest = findBlockManifestById(block.block_manifest_id);
    if (!blockManifest) {
      throw new Error(`block_manifest_not_found:${block.block_manifest_id}`);
    }
    const semanticBlock = blockManifest ? findSemanticBlockById(blockManifest.semantic_block_id) : null;
    const recipeId = blockManifest.recipe_id;
    const recipe = findRecipeById(recipeId);
    if (!recipe) {
      throw new Error(`recipe_not_found:${recipeId}`);
    }

    return {
      id: block.id,
      block: blockManifest,
      semanticBlock,
      recipe,
      props: {
        ...(blockManifest?.default_props ?? {}),
        ...(block.props ?? {}),
      },
    };
  });

  return {
    screen: selectedScreenManifest,
    blocks,
    tokens: mergeTokens(tokenPack.tokens, modePack.tokens, branchOverlay.tokens),
    tokenPackId: tokenPack.id,
    themeFamily: tokenPack.theme_family,
    experimentResolution,
  };
}
