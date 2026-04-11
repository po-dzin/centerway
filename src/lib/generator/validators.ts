import { enforceCanonForScreen } from "@/lib/generator/canon";
import type {
  ArchetypeContract,
  ArchetypeContractsManifest,
  BlockManifest,
  BranchOverlayManifest,
  ComponentRecipeManifest,
  CWSemanticFamily,
  CWSemanticBlockGroup,
  ExperimentManifest,
  ModePackManifest,
  ScreenManifest,
  SemanticBlockManifest,
  TokenPackManifest,
} from "@/lib/generator/types";

const SEMANTIC_FAMILIES = new Set<CWSemanticFamily>([
  "calm",
  "method",
  "guide",
  "trust",
  "progress",
  "organic",
  "embodied",
  "boundary",
]);

const SEMANTIC_GROUPS = new Set<CWSemanticBlockGroup>([
  "orientation",
  "offer_route",
  "method_explanation",
  "trust_proof_expectation",
  "support_care",
  "progress_pathway",
  "boundary_caution",
]);

function isObject(input: unknown): input is Record<string, unknown> {
  return Boolean(input) && typeof input === "object" && !Array.isArray(input);
}

function asString(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asStringRecord(input: unknown): Record<`--${string}`, string> | null {
  if (!isObject(input)) return null;
  const out: Record<`--${string}`, string> = {};
  for (const [key, value] of Object.entries(input)) {
    if (!key.startsWith("--") || typeof value !== "string") return null;
    out[key as `--${string}`] = value;
  }
  return out;
}

function asStringArray(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((value) => asString(value))
    .filter((value): value is string => Boolean(value));
}

function ensureUnique(ids: string[], entityName: string): void {
  const set = new Set<string>();
  for (const id of ids) {
    if (set.has(id)) {
      throw new Error(`${entityName}_duplicate_id:${id}`);
    }
    set.add(id);
  }
}

const CTA_CARDINALITY = new Set(["1", "0..1", "1..N", "0"]);
const CANONICAL_ARCHETYPES = new Set<ArchetypeContract["archetype"]>([
  "overview-entry",
  "offer-detail",
  "intent-checkout",
  "lesson-practice",
  "dashboard-route",
  "support-proof",
  "overlay-modal",
  "admin-utility",
]);

export function validateArchetypeContracts(input: unknown): ArchetypeContractsManifest {
  if (!isObject(input) || !Array.isArray(input.contracts) || !Array.isArray(input.archetype_registry)) {
    throw new Error("archetype_contracts_invalid_shape");
  }

  const schemaVersion = asString(input.schema_version);
  const spec = asString(input.spec);
  const specVersion = asString(input.spec_version);
  if (!schemaVersion || !spec || !specVersion) {
    throw new Error("archetype_contracts_invalid_meta");
  }

  const registry = input.archetype_registry.map((value, idx) => {
    const archetype = asString(value);
    if (!archetype) {
      throw new Error(`archetype_contracts_invalid_registry_item:${idx}`);
    }
    if (!CANONICAL_ARCHETYPES.has(archetype as ArchetypeContract["archetype"])) {
      throw new Error(`archetype_contract_unknown_registry_item:${archetype}`);
    }
    return archetype as ArchetypeContract["archetype"];
  });
  ensureUnique(registry, "archetype_contract_registry");

  const contracts = input.contracts.map((entry, idx) => {
    if (!isObject(entry)) {
      throw new Error(`archetype_contract_invalid_entry:${idx}`);
    }
    const archetype = asString(entry.archetype);
    const primaryCTA = asString(entry.primaryCTA);
    if (!archetype || !primaryCTA || !CTA_CARDINALITY.has(primaryCTA)) {
      throw new Error(`archetype_contract_invalid_fields:${idx}`);
    }
    if (!registry.includes(archetype as ArchetypeContract["archetype"])) {
      throw new Error(`archetype_contract_not_in_registry:${archetype}`);
    }

    const semanticBlocks = isObject(entry.semanticBlocks) ? entry.semanticBlocks : null;
    const componentFamilies = isObject(entry.componentFamilies) ? entry.componentFamilies : null;
    if (!semanticBlocks || !componentFamilies) {
      throw new Error(`archetype_contract_invalid_layers:${archetype}`);
    }

    const semanticRequired = Array.isArray(semanticBlocks.required) ? semanticBlocks.required : [];
    const semanticOptional = Array.isArray(semanticBlocks.optional) ? semanticBlocks.optional : [];
    const semanticConditional = Array.isArray(semanticBlocks.conditional) ? semanticBlocks.conditional : [];
    const semanticForbidden = Array.isArray(semanticBlocks.forbidden) ? semanticBlocks.forbidden : [];

    const componentRequired = Array.isArray(componentFamilies.required) ? componentFamilies.required : [];
    const componentOptional = Array.isArray(componentFamilies.optional) ? componentFamilies.optional : [];
    const componentConditional = Array.isArray(componentFamilies.conditional) ? componentFamilies.conditional : [];
    const componentForbidden = Array.isArray(componentFamilies.forbidden) ? componentFamilies.forbidden : [];

    if (semanticRequired.length === 0) {
      throw new Error(`archetype_contract_missing_required_semantic_blocks:${archetype}`);
    }
    if (componentRequired.length === 0) {
      throw new Error(`archetype_contract_missing_required_component_families:${archetype}`);
    }

    return {
      archetype: archetype as ArchetypeContract["archetype"],
      primaryCTA: primaryCTA as ArchetypeContract["primaryCTA"],
      primary_cta_repetition: asString(entry.primary_cta_repetition) as ArchetypeContract["primary_cta_repetition"],
      semanticBlocks: {
        required: semanticRequired.filter((value): value is string => typeof value === "string"),
        optional: semanticOptional.filter((value): value is string => typeof value === "string"),
        conditional: semanticConditional.filter((value): value is string => typeof value === "string"),
        forbidden: semanticForbidden.filter((value): value is string => typeof value === "string"),
      },
      componentFamilies: {
        required: componentRequired.filter((value): value is string => typeof value === "string"),
        optional: componentOptional.filter((value): value is string => typeof value === "string"),
        conditional: componentConditional.filter((value): value is string => typeof value === "string"),
        forbidden: componentForbidden.filter((value): value is string => typeof value === "string"),
      },
      rules: Array.isArray(entry.rules) ? entry.rules.filter((value): value is string => typeof value === "string") : [],
    } satisfies ArchetypeContract;
  });

  ensureUnique(contracts.map((item) => item.archetype), "archetype_contract");

  for (const archetype of registry) {
    if (!contracts.some((contract) => contract.archetype === archetype)) {
      throw new Error(`archetype_contract_missing_for_registry_item:${archetype}`);
    }
  }

  const engineBindings = isObject(input.engine_bindings) ? input.engine_bindings : undefined;
  const aliases = isObject(engineBindings?.archetype_aliases) ? engineBindings.archetype_aliases : undefined;
  if (aliases) {
    if (Object.keys(aliases).length > 0) {
      throw new Error("archetype_contract_aliases_not_allowed");
    }
  }

  const requiredSemantics = isObject(engineBindings?.required_semantics_by_contract)
    ? engineBindings.required_semantics_by_contract
    : undefined;
  if (requiredSemantics) {
    for (const [archetype, semantics] of Object.entries(requiredSemantics)) {
      if (!registry.includes(archetype as ArchetypeContract["archetype"])) {
        throw new Error(`archetype_contract_required_semantics_unknown_archetype:${archetype}`);
      }
      if (!Array.isArray(semantics) || semantics.some((item) => !SEMANTIC_FAMILIES.has(item as CWSemanticFamily))) {
        throw new Error(`archetype_contract_required_semantics_invalid:${archetype}`);
      }
    }
  }

  type EngineBindings = NonNullable<ArchetypeContractsManifest["engine_bindings"]>;

  return {
    schema_version: schemaVersion,
    spec,
    spec_version: specVersion,
    archetype_registry: registry,
    engine_bindings: {
      archetype_aliases: aliases as EngineBindings["archetype_aliases"],
      required_semantics_by_contract: requiredSemantics as EngineBindings["required_semantics_by_contract"],
    },
    contracts,
    ordered_sequences: isObject(input.ordered_sequences)
      ? (input.ordered_sequences as ArchetypeContractsManifest["ordered_sequences"])
      : undefined,
    assembly_constraints: Array.isArray(input.assembly_constraints)
      ? input.assembly_constraints.filter((item): item is string => typeof item === "string")
      : undefined,
  };
}

export function validateTokenPacks(input: unknown): TokenPackManifest[] {
  if (!isObject(input) || !Array.isArray(input.packs)) {
    throw new Error("token_packs_invalid_shape");
  }

  const packs = input.packs.map((entry, idx) => {
    if (!isObject(entry)) {
      throw new Error(`token_pack_invalid_entry:${idx}`);
    }
    const id = asString(entry.id);
    const version = asString(entry.version);
    const themeFamily = asString(entry.theme_family);
    const tokens = asStringRecord(entry.tokens);
    if (!id || !version || !themeFamily || !tokens) {
      throw new Error(`token_pack_invalid_fields:${idx}`);
    }
    return {
      id,
      version,
      theme_family: themeFamily as TokenPackManifest["theme_family"],
      tokens,
    };
  });

  ensureUnique(packs.map((item) => item.id), "token_pack");
  return packs;
}

export function validateModePacks(input: unknown): ModePackManifest[] {
  if (!isObject(input) || !Array.isArray(input.packs)) {
    throw new Error("mode_packs_invalid_shape");
  }

  const packs = input.packs.map((entry, idx) => {
    if (!isObject(entry)) {
      throw new Error(`mode_pack_invalid_entry:${idx}`);
    }
    const id = asString(entry.id);
    const version = asString(entry.version);
    const mode = asString(entry.mode);
    const tokens = asStringRecord(entry.tokens);
    if (!id || !version || !mode || !tokens) {
      throw new Error(`mode_pack_invalid_fields:${idx}`);
    }
    return {
      id,
      version,
      mode: mode as ModePackManifest["mode"],
      tokens,
    };
  });

  ensureUnique(packs.map((item) => item.id), "mode_pack");
  return packs;
}

export function validateBranchOverlays(input: unknown): BranchOverlayManifest[] {
  if (!isObject(input) || !Array.isArray(input.overlays)) {
    throw new Error("branch_overlays_invalid_shape");
  }

  const overlays = input.overlays.map((entry, idx) => {
    if (!isObject(entry)) {
      throw new Error(`branch_overlay_invalid_entry:${idx}`);
    }
    const id = asString(entry.id);
    const version = asString(entry.version);
    const branch = asString(entry.branch);
    const tokens = asStringRecord(entry.tokens);
    if (!id || !version || !branch || !tokens) {
      throw new Error(`branch_overlay_invalid_fields:${idx}`);
    }
    return {
      id,
      version,
      branch: branch as BranchOverlayManifest["branch"],
      tokens,
    };
  });

  ensureUnique(overlays.map((item) => item.id), "branch_overlay");
  return overlays;
}

export function validateRecipes(input: unknown): ComponentRecipeManifest[] {
  if (!isObject(input) || !Array.isArray(input.recipes)) {
    throw new Error("recipes_invalid_shape");
  }

  const recipes = input.recipes.map((entry, idx) => {
    if (!isObject(entry)) {
      throw new Error(`recipe_invalid_entry:${idx}`);
    }
    const id = asString(entry.id);
    const version = asString(entry.version);
    const componentKey = asString(entry.component_key);
    if (!id || !version || !componentKey) {
      throw new Error(`recipe_invalid_fields:${idx}`);
    }
    return {
      id,
      version,
      component_key: componentKey,
    };
  });

  ensureUnique(recipes.map((item) => item.id), "recipe");
  return recipes;
}

export function validateSemanticBlocks(input: unknown): SemanticBlockManifest[] {
  if (!isObject(input) || !Array.isArray(input.blocks)) {
    throw new Error("semantic_blocks_invalid_shape");
  }

  const blocks = input.blocks.map((entry, idx) => {
    if (!isObject(entry)) {
      throw new Error(`semantic_block_invalid_entry:${idx}`);
    }

    const id = asString(entry.id);
    const version = asString(entry.version);
    const blockType = asString(entry.block_type);
    const family = asString(entry.family);
    const primarySemantic = asString(entry.primary_semantic);
    const userQuestion = asString(entry.user_question);
    const dominantAction = asString(entry.dominant_action);
    const tier = asString(entry.tier);

    if (!id || !version || !blockType || !family || !primarySemantic || !userQuestion || !dominantAction || !tier) {
      throw new Error(`semantic_block_invalid_fields:${idx}`);
    }

    if (!SEMANTIC_GROUPS.has(family as CWSemanticBlockGroup)) {
      throw new Error(`semantic_block_invalid_group:${id}:${family}`);
    }

    if (!SEMANTIC_FAMILIES.has(primarySemantic as CWSemanticFamily)) {
      throw new Error(`semantic_block_invalid_primary_semantic:${id}:${primarySemantic}`);
    }

    if (!Array.isArray(entry.semantic_tags) || entry.semantic_tags.length === 0) {
      throw new Error(`semantic_block_invalid_semantic_tags:${id}`);
    }

    const tags = entry.semantic_tags.map((value, tagIdx) => {
      const tag = asString(value);
      if (!tag || !SEMANTIC_FAMILIES.has(tag as CWSemanticFamily)) {
        throw new Error(`semantic_block_invalid_tag:${id}:${tagIdx}`);
      }
      return tag as CWSemanticFamily;
    });

    return {
      id,
      version,
      block_type: blockType,
      family: family as CWSemanticBlockGroup,
      primary_semantic: primarySemantic as CWSemanticFamily,
      semantic_tags: tags,
      user_question: userQuestion,
      dominant_action: dominantAction,
      tier: tier as SemanticBlockManifest["tier"],
    };
  });

  ensureUnique(blocks.map((item) => item.id), "semantic_block");
  return blocks;
}

export function validateBlockManifests(input: unknown): BlockManifest[] {
  if (!isObject(input) || !Array.isArray(input.blocks)) {
    throw new Error("block_manifests_invalid_shape");
  }

  const manifests = input.blocks.map((entry, idx) => {
    if (!isObject(entry)) {
      throw new Error(`block_manifest_invalid_entry:${idx}`);
    }

    const id = asString(entry.id);
    const version = asString(entry.version);
    const semanticBlockId = asString(entry.semantic_block_id);
    const semanticBlockVersion = asString(entry.semantic_block_version);
    const recipeId = asString(entry.recipe_id);
    const recipeVersion = asString(entry.recipe_version);
    const actionRole = asString(entry.action_role);
    const renderMode = asString(entry.render_mode);

    if (!id || !version || !semanticBlockId || !semanticBlockVersion || !recipeId || !recipeVersion || !actionRole) {
      throw new Error(`block_manifest_invalid_fields:${idx}`);
    }

    if (!["primary", "support", "none"].includes(actionRole)) {
      throw new Error(`block_manifest_invalid_action_role:${id}:${actionRole}`);
    }
    if (renderMode && !["visual", "semantic-only"].includes(renderMode)) {
      throw new Error(`block_manifest_invalid_render_mode:${id}:${renderMode}`);
    }

    return {
      id,
      version,
      semantic_block_id: semanticBlockId,
      semantic_block_version: semanticBlockVersion,
      recipe_id: recipeId,
      recipe_version: recipeVersion,
      action_role: actionRole as BlockManifest["action_role"],
      render_mode: (renderMode as BlockManifest["render_mode"] | null) ?? undefined,
      component_families: asStringArray(entry.component_families),
      default_props: isObject(entry.default_props) ? entry.default_props : {},
    };
  });

  ensureUnique(manifests.map((item) => item.id), "block_manifest");
  return manifests;
}

export function validateScreens(input: unknown): ScreenManifest[] {
  if (!isObject(input) || !Array.isArray(input.manifests)) {
    throw new Error("screen_manifests_invalid_shape");
  }

  const manifests = input.manifests.map((entry, idx) => {
    if (!isObject(entry)) {
      throw new Error(`screen_manifest_invalid_entry:${idx}`);
    }

    const id = asString(entry.id);
    const version = asString(entry.version);
    const routeKey = asString(entry.route_key);
    const archetype = asString(entry.archetype);
    const mode = asString(entry.mode);
    const branch = asString(entry.branch);
    const tokenPackId = asString(entry.token_pack_id);
    const modePackId = asString(entry.mode_pack_id);
    const branchOverlayId = asString(entry.branch_overlay_id);

    if (!id || !version || !routeKey || !archetype || !mode || !branch || !tokenPackId || !modePackId || !branchOverlayId) {
      throw new Error(`screen_manifest_invalid_fields:${idx}`);
    }
    if (!CANONICAL_ARCHETYPES.has(archetype as ArchetypeContract["archetype"])) {
      throw new Error(`screen_manifest_invalid_archetype:${id}:${archetype}`);
    }

    if (!Array.isArray(entry.blocks) || entry.blocks.length === 0) {
      throw new Error(`screen_manifest_invalid_blocks:${id}`);
    }

    const blocks = entry.blocks.map((block, blockIdx) => {
      if (!isObject(block)) {
        throw new Error(`screen_manifest_invalid_block:${id}:${blockIdx}`);
      }

      const blockId = asString(block.id);
      const blockManifestId = asString(block.block_manifest_id);
      const blockManifestVersion = asString(block.block_manifest_version);
      if (!blockId) {
        throw new Error(`screen_manifest_invalid_block_fields:${id}:${blockIdx}`);
      }
      if (!blockManifestId || !blockManifestVersion) {
        throw new Error(`screen_manifest_missing_block_manifest_ref:${id}:${blockId}`);
      }

      return {
        id: blockId,
        block_manifest_id: blockManifestId,
        block_manifest_version: blockManifestVersion,
        props: isObject(block.props) ? block.props : {},
      };
    });

    return {
      id,
      version,
      route_key: routeKey as ScreenManifest["route_key"],
      archetype: archetype as ScreenManifest["archetype"],
      mode: mode as ScreenManifest["mode"],
      branch: branch as ScreenManifest["branch"],
      token_pack_id: tokenPackId,
      mode_pack_id: modePackId,
      branch_overlay_id: branchOverlayId,
      blocks,
    };
  });

  ensureUnique(manifests.map((item) => item.id), "screen_manifest");
  return manifests;
}

export function validateExperiments(input: unknown): ExperimentManifest[] {
  if (!isObject(input) || !Array.isArray(input.experiments)) {
    throw new Error("experiments_invalid_shape");
  }

  const experiments = input.experiments.map((entry, idx) => {
    if (!isObject(entry)) {
      throw new Error(`experiment_invalid_entry:${idx}`);
    }

    const id = asString(entry.id);
    const key = asString(entry.key);
    const version = asString(entry.version);
    const status = asString(entry.status);
    const routeKey = asString(entry.route_key);
    const defaultVariant = asString(entry.default_variant);

    if (!id || !key || !version || !status || !routeKey || !defaultVariant) {
      throw new Error(`experiment_invalid_fields:${idx}`);
    }

    if (!Array.isArray(entry.variants) || entry.variants.length === 0) {
      throw new Error(`experiment_invalid_variants:${key}`);
    }

    const variants = entry.variants.map((variant, variantIdx) => {
      if (!isObject(variant)) {
        throw new Error(`experiment_invalid_variant:${key}:${variantIdx}`);
      }
      const variantKey = asString(variant.key);
      const screenManifestId = asString(variant.screen_manifest_id);
      const weight = typeof variant.weight === "number" ? variant.weight : Number.NaN;
      if (!variantKey || !screenManifestId || !Number.isFinite(weight) || weight <= 0) {
        throw new Error(`experiment_invalid_variant_fields:${key}:${variantIdx}`);
      }
      return {
        key: variantKey,
        weight,
        screen_manifest_id: screenManifestId,
      };
    });

    const hasDefault = variants.some((variant) => variant.key === defaultVariant);
    if (!hasDefault) {
      throw new Error(`experiment_default_variant_missing:${key}`);
    }

    return {
      id,
      key,
      version,
      status: status as ExperimentManifest["status"],
      route_key: routeKey as ExperimentManifest["route_key"],
      default_variant: defaultVariant,
      variants,
    };
  });

  ensureUnique(experiments.map((item) => item.id), "experiment");
  ensureUnique(experiments.map((item) => item.key), "experiment_key");
  return experiments;
}

export function enforceCanonicalIntegrity(
  screens: ScreenManifest[],
  blockManifests: BlockManifest[],
  semanticBlocks: SemanticBlockManifest[],
  recipes: ComponentRecipeManifest[]
): void {
  const blockManifestMap = new Map(blockManifests.map((item) => [item.id, item]));
  const semanticBlockMap = new Map(semanticBlocks.map((item) => [item.id, item]));
  const recipeMap = new Map(recipes.map((item) => [item.id, item]));

  for (const blockManifest of blockManifests) {
    const semanticBlock = semanticBlockMap.get(blockManifest.semantic_block_id);
    if (!semanticBlock) {
      throw new Error(`canon_block_manifest_semantic_missing:${blockManifest.id}:${blockManifest.semantic_block_id}`);
    }
    if (semanticBlock.version !== blockManifest.semantic_block_version) {
      throw new Error(`canon_block_manifest_semantic_version_mismatch:${blockManifest.id}`);
    }

    const recipe = recipeMap.get(blockManifest.recipe_id);
    if (!recipe) {
      throw new Error(`canon_block_manifest_recipe_missing:${blockManifest.id}:${blockManifest.recipe_id}`);
    }
    if (recipe.version !== blockManifest.recipe_version) {
      throw new Error(`canon_block_manifest_recipe_version_mismatch:${blockManifest.id}`);
    }
  }

  for (const screen of screens) {
    const screenBlockManifests: BlockManifest[] = [];
    const screenSemanticBlocks: SemanticBlockManifest[] = [];

    for (const block of screen.blocks) {
      const blockManifest = blockManifestMap.get(block.block_manifest_id);
      if (!blockManifest) {
        throw new Error(`canon_screen_missing_block_manifest:${screen.id}:${block.block_manifest_id}`);
      }

      if (block.block_manifest_version !== blockManifest.version) {
        throw new Error(`canon_screen_block_manifest_version_mismatch:${screen.id}:${block.id}`);
      }

      screenBlockManifests.push(blockManifest);

      const semanticBlock = semanticBlockMap.get(blockManifest.semantic_block_id);
      if (!semanticBlock) {
        throw new Error(`canon_screen_missing_semantic_block:${screen.id}:${blockManifest.semantic_block_id}`);
      }
      screenSemanticBlocks.push(semanticBlock);
    }

    if (screenBlockManifests.length > 0) {
      enforceCanonForScreen(screen, screenBlockManifests, screenSemanticBlocks);
    }
  }
}
