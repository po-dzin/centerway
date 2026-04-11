import fs from "node:fs/promises";
import path from "node:path";

const REQUIRED_FILES = {
  tokenPacks: "token_packs.json",
  modePacks: "mode_packs.json",
  branchOverlays: "branch_overlays.json",
  recipes: "component_recipes.json",
  semanticBlocks: "semantic_block_layer.json",
  blockManifests: "block_manifests.json",
  funnelContent: "funnel_content.json",
  screens: "screen_manifests.json",
  experiments: "experiment_manifests.json",
  archetypeContracts: "archetype_contracts_v0_1.json",
};

const DEFAULT_SCREEN_BY_ROUTE = {
  consult: "screen.consult.v1.control",
  detox: "screen.detox.v1.control",
  herbs: "screen.herbs.v1.control",
  "dosha-test": "screen.dosha-test.v1.control",
  "lesson-pilot": "screen.lesson.pilot.v1.control",
};

const VALID_ROUTES = new Set(["consult", "detox", "herbs", "dosha-test", "lesson-pilot"]);
const VALID_MODES = new Set(["consult", "detox", "herbs", "lesson", "dashboard", "support", "admin"]);
const VALID_BRANCHES = new Set(["consult", "detox", "herbs", "short", "irem", "platform"]);
const VALID_EXPERIMENT_STATUS = new Set(["active", "paused"]);
const VALID_SEMANTIC_GROUPS = new Set([
  "orientation",
  "offer_route",
  "method_explanation",
  "trust_proof_expectation",
  "support_care",
  "progress_pathway",
  "boundary_caution",
]);
const VALID_SEMANTICS = new Set(["calm", "method", "guide", "trust", "progress", "organic", "embodied", "boundary"]);
const VALID_ACTION_ROLES = new Set(["primary", "support", "none"]);
const VALID_RENDER_MODES = new Set(["visual", "semantic-only"]);
const REQUIRED_TOKEN_KEYS = [
  "--cw-bg",
  "--cw-text",
  "--cw-accent",
  "--cw-border",
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asNonEmptyString(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function ensureUnique(items, keyName, label) {
  const seen = new Set();
  for (const item of items) {
    const key = item[keyName];
    assert(typeof key === "string", `${label}_missing_${keyName}`);
    assert(!seen.has(key), `${label}_duplicate_${keyName}:${key}`);
    seen.add(key);
  }
}

function validateTokensMap(tokens, label) {
  assert(isRecord(tokens), `${label}_tokens_invalid_shape`);
  for (const [name, value] of Object.entries(tokens)) {
    assert(name.startsWith("--"), `${label}_token_key_invalid:${name}`);
    assert(typeof value === "string", `${label}_token_value_invalid:${name}`);
  }
}

function hexToRgb(hex) {
  if (typeof hex !== "string") return null;
  const clean = hex.trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return null;
  return {
    r: Number.parseInt(clean.slice(0, 2), 16),
    g: Number.parseInt(clean.slice(2, 4), 16),
    b: Number.parseInt(clean.slice(4, 6), 16),
  };
}

function relativeLuminance(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  const convert = (channel) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  const r = convert(rgb.r);
  const g = convert(rgb.g);
  const b = convert(rgb.b);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(foregroundHex, backgroundHex) {
  const l1 = relativeLuminance(foregroundHex);
  const l2 = relativeLuminance(backgroundHex);
  if (l1 === null || l2 === null) return null;
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function validateSchemaVersion(doc, label) {
  assert(isRecord(doc), `${label}_invalid_shape`);
  assert(asNonEmptyString(doc.schema_version), `${label}_schema_version_missing`);
}

function cardinalityToRange(value) {
  if (value === "0") return { min: 0, max: 0 };
  if (value === "0..1") return { min: 0, max: 1 };
  if (value === "1..N") return { min: 1, max: Number.MAX_SAFE_INTEGER };
  return { min: 1, max: 1 };
}

function primaryActionRange(contract) {
  const strict = cardinalityToRange(contract.primaryCTA);
  if (!contract.primary_cta_repetition) return strict;
  const repeated = cardinalityToRange(contract.primary_cta_repetition);
  return {
    min: Math.max(strict.min, repeated.min),
    max: Math.max(strict.max, repeated.max),
  };
}

function createArchetypeBindings(archetypeContracts) {
  if (!isRecord(archetypeContracts)) {
    return {
      contractByArchetype: new Map(),
      requiredSemanticsByContract: {},
    };
  }

  const contracts = Array.isArray(archetypeContracts.contracts) ? archetypeContracts.contracts : [];
  const contractByArchetype = new Map();
  for (const contract of contracts) {
    if (isRecord(contract) && typeof contract.archetype === "string" && typeof contract.primaryCTA === "string") {
      contractByArchetype.set(contract.archetype, contract);
    }
  }

  const bindings = isRecord(archetypeContracts.engine_bindings) ? archetypeContracts.engine_bindings : {};
  const semanticsInput = isRecord(bindings.required_semantics_by_contract) ? bindings.required_semantics_by_contract : {};

  const requiredSemanticsByContract = {};
  for (const [archetype, semantics] of Object.entries(semanticsInput)) {
    if (!contractByArchetype.has(archetype)) continue;
    if (!Array.isArray(semantics)) continue;
    requiredSemanticsByContract[archetype] = semantics
      .filter((item) => typeof item === "string" && VALID_SEMANTICS.has(item));
  }

  return { contractByArchetype, requiredSemanticsByContract };
}

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, "utf8");
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`json_parse_failed:${path.basename(filePath)}:${error instanceof Error ? error.message : "unknown"}`);
  }
}

export async function loadGeneratorManifests(rootDir = process.cwd()) {
  const generatorDir = path.join(rootDir, "data", "generator");

  const entries = await Promise.all(
    Object.entries(REQUIRED_FILES).map(async ([key, fileName]) => {
      const fullPath = path.join(generatorDir, fileName);
      const data = await readJson(fullPath);
      return [key, data];
    })
  );

  const manifests = Object.fromEntries(entries);
  return {
    generatorDir,
    manifests,
  };
}

function normalizeCanonKey(value) {
  return String(value).trim().toLowerCase().replace(/[_\s/]+/g, "-");
}

function enforceCanonForScreen(screen, blocks, semanticBlocks, archetypeBindings) {
  const contract = archetypeBindings.contractByArchetype.get(screen.archetype);
  assert(contract, `canon_unknown_archetype:${screen.id}:${screen.archetype}`);
  const required = archetypeBindings.requiredSemanticsByContract[screen.archetype] ?? [];
  if (required.length > 0) {
    const semanticSet = new Set();
    for (const semanticBlock of semanticBlocks) {
      semanticSet.add(semanticBlock.primary_semantic);
      for (const tag of semanticBlock.semantic_tags) {
        semanticSet.add(tag);
      }
    }

    for (const semantic of required) {
      assert(semanticSet.has(semantic), `canon_missing_semantic:${screen.id}:${screen.archetype}:${semantic}`);
    }
  }

  const rule = primaryActionRange(contract);
  const primaryCount = blocks.filter((item) => item.action_role === "primary").length;
  assert(
    primaryCount >= rule.min && primaryCount <= rule.max,
    `canon_primary_action_invalid:${screen.id}:${screen.archetype}:expected_${rule.min}_${rule.max}:got_${primaryCount}`
  );

  const semanticBlockTypes = new Set(semanticBlocks.map((item) => normalizeCanonKey(item.block_type)));
  for (const requiredBlock of contract.semanticBlocks?.required ?? []) {
    const normalized = normalizeCanonKey(requiredBlock);
    assert(semanticBlockTypes.has(normalized), `canon_missing_required_block:${screen.id}:${screen.archetype}:${requiredBlock}`);
  }

  for (const forbiddenBlock of contract.semanticBlocks?.forbidden ?? []) {
    const normalized = normalizeCanonKey(forbiddenBlock);
    assert(!semanticBlockTypes.has(normalized), `canon_forbidden_block_present:${screen.id}:${screen.archetype}:${forbiddenBlock}`);
  }

  const familySet = new Set();
  for (const block of blocks) {
    for (const family of block.component_families ?? []) {
      familySet.add(normalizeCanonKey(family));
    }
  }

  for (const requiredFamily of contract.componentFamilies?.required ?? []) {
    const normalized = normalizeCanonKey(requiredFamily);
    assert(familySet.has(normalized), `canon_missing_required_component_family:${screen.id}:${screen.archetype}:${requiredFamily}`);
  }

  for (const forbiddenFamily of contract.componentFamilies?.forbidden ?? []) {
    const normalized = normalizeCanonKey(forbiddenFamily);
    assert(!familySet.has(normalized), `canon_forbidden_component_family_present:${screen.id}:${screen.archetype}:${forbiddenFamily}`);
  }

  const allowedFamilies = new Set(
    [
      ...(contract.componentFamilies?.required ?? []),
      ...(contract.componentFamilies?.optional ?? []),
      ...(contract.componentFamilies?.conditional ?? []),
    ].map((item) => normalizeCanonKey(item))
  );

  for (const family of familySet) {
    assert(allowedFamilies.has(family), `canon_component_family_not_allowed:${screen.id}:${screen.archetype}:${family}`);
  }
}

export function validateGeneratorManifests(manifests) {
  const {
    tokenPacks,
    modePacks,
    branchOverlays,
    recipes,
    semanticBlocks,
    blockManifests,
    funnelContent,
    screens,
    experiments,
    archetypeContracts,
  } = manifests;

  validateSchemaVersion(tokenPacks, "token_packs");
  validateSchemaVersion(modePacks, "mode_packs");
  validateSchemaVersion(branchOverlays, "branch_overlays");
  validateSchemaVersion(recipes, "component_recipes");
  validateSchemaVersion(semanticBlocks, "semantic_block_layer");
  validateSchemaVersion(blockManifests, "block_manifests");
  validateSchemaVersion(funnelContent, "funnel_content");
  validateSchemaVersion(screens, "screen_manifests");
  validateSchemaVersion(experiments, "experiment_manifests");
  validateSchemaVersion(archetypeContracts, "archetype_contracts");

  assert(Array.isArray(tokenPacks.packs) && tokenPacks.packs.length > 0, "token_packs_empty");
  assert(Array.isArray(modePacks.packs) && modePacks.packs.length > 0, "mode_packs_empty");
  assert(Array.isArray(branchOverlays.overlays) && branchOverlays.overlays.length > 0, "branch_overlays_empty");
  assert(Array.isArray(recipes.recipes) && recipes.recipes.length > 0, "component_recipes_empty");
  assert(Array.isArray(semanticBlocks.blocks) && semanticBlocks.blocks.length > 0, "semantic_blocks_empty");
  assert(Array.isArray(blockManifests.blocks) && blockManifests.blocks.length > 0, "block_manifests_empty");
  assert(isRecord(funnelContent.content), "funnel_content_invalid_shape");
  for (const route of ["consult", "detox", "herbs"]) {
    const routeContent = funnelContent.content[route];
    assert(isRecord(routeContent), `funnel_content_missing_route:${route}`);
    assert(asNonEmptyString(routeContent.title), `funnel_content_missing_title:${route}`);
    assert(asNonEmptyString(routeContent.lead), `funnel_content_missing_lead:${route}`);
    assert(Array.isArray(routeContent.heroHighlights) && routeContent.heroHighlights.length > 0, `funnel_content_missing_hero_highlights:${route}`);
    assert(Array.isArray(routeContent.routeCards) && routeContent.routeCards.length > 0, `funnel_content_missing_route_cards:${route}`);
    assert(Array.isArray(routeContent.nextStepChecklist) && routeContent.nextStepChecklist.length > 0, `funnel_content_missing_next_step:${route}`);
    assert(isRecord(routeContent.nextBestRoute) && asNonEmptyString(routeContent.nextBestRoute.title), `funnel_content_missing_next_best_route:${route}`);
  }
  assert(Array.isArray(screens.manifests) && screens.manifests.length > 0, "screen_manifests_empty");
  assert(Array.isArray(experiments.experiments), "experiment_manifests_invalid_experiments");
  assert(Array.isArray(archetypeContracts.contracts) && archetypeContracts.contracts.length > 0, "archetype_contracts_empty");

  const archetypeBindings = createArchetypeBindings(archetypeContracts);

  const tokenPackList = tokenPacks.packs.map((entry, idx) => {
    assert(isRecord(entry), `token_pack_invalid_entry:${idx}`);
    const id = asNonEmptyString(entry.id);
    const version = asNonEmptyString(entry.version);
    const themeFamily = asNonEmptyString(entry.theme_family);
    assert(id && version && themeFamily, `token_pack_invalid_fields:${idx}`);
    validateTokensMap(entry.tokens, `token_pack:${id}`);
    for (const requiredKey of REQUIRED_TOKEN_KEYS) {
      assert(typeof entry.tokens[requiredKey] === "string", `token_pack_missing_required_token:${id}:${requiredKey}`);
    }

    const contrast = contrastRatio(entry.tokens["--cw-text"], entry.tokens["--cw-bg"]);
    assert(contrast !== null && contrast >= 4.5, `token_pack_contrast_low:${id}:${contrast ?? "invalid"}`);
    return { id, version, theme_family: themeFamily, tokens: entry.tokens };
  });
  ensureUnique(tokenPackList, "id", "token_pack");

  const modePackList = modePacks.packs.map((entry, idx) => {
    assert(isRecord(entry), `mode_pack_invalid_entry:${idx}`);
    const id = asNonEmptyString(entry.id);
    const version = asNonEmptyString(entry.version);
    const mode = asNonEmptyString(entry.mode);
    assert(id && version && mode, `mode_pack_invalid_fields:${idx}`);
    assert(VALID_MODES.has(mode), `mode_pack_invalid_mode:${id}:${mode}`);
    validateTokensMap(entry.tokens, `mode_pack:${id}`);
    return { id, version, mode, tokens: entry.tokens };
  });
  ensureUnique(modePackList, "id", "mode_pack");

  const branchOverlayList = branchOverlays.overlays.map((entry, idx) => {
    assert(isRecord(entry), `branch_overlay_invalid_entry:${idx}`);
    const id = asNonEmptyString(entry.id);
    const version = asNonEmptyString(entry.version);
    const branch = asNonEmptyString(entry.branch);
    assert(id && version && branch, `branch_overlay_invalid_fields:${idx}`);
    assert(VALID_BRANCHES.has(branch), `branch_overlay_invalid_branch:${id}:${branch}`);
    validateTokensMap(entry.tokens, `branch_overlay:${id}`);
    return { id, version, branch, tokens: entry.tokens };
  });
  ensureUnique(branchOverlayList, "id", "branch_overlay");

  const recipeList = recipes.recipes.map((entry, idx) => {
    assert(isRecord(entry), `recipe_invalid_entry:${idx}`);
    const id = asNonEmptyString(entry.id);
    const version = asNonEmptyString(entry.version);
    const componentKey = asNonEmptyString(entry.component_key);
    assert(id && version && componentKey, `recipe_invalid_fields:${idx}`);
    return { id, version, component_key: componentKey };
  });
  ensureUnique(recipeList, "id", "recipe");

  const semanticBlockList = semanticBlocks.blocks.map((entry, idx) => {
    assert(isRecord(entry), `semantic_block_invalid_entry:${idx}`);
    const id = asNonEmptyString(entry.id);
    const version = asNonEmptyString(entry.version);
    const blockType = asNonEmptyString(entry.block_type);
    const family = asNonEmptyString(entry.family);
    const primarySemantic = asNonEmptyString(entry.primary_semantic);
    const userQuestion = asNonEmptyString(entry.user_question);
    const dominantAction = asNonEmptyString(entry.dominant_action);
    const tier = asNonEmptyString(entry.tier);
    assert(id && version && blockType && family && primarySemantic && userQuestion && dominantAction && tier, `semantic_block_invalid_fields:${idx}`);
    assert(VALID_SEMANTIC_GROUPS.has(family), `semantic_block_invalid_group:${id}:${family}`);
    assert(VALID_SEMANTICS.has(primarySemantic), `semantic_block_invalid_primary_semantic:${id}:${primarySemantic}`);
    assert(Array.isArray(entry.semantic_tags) && entry.semantic_tags.length > 0, `semantic_block_invalid_semantic_tags:${id}`);
    const semanticTags = entry.semantic_tags.map((tag, tagIdx) => {
      const value = asNonEmptyString(tag);
      assert(value && VALID_SEMANTICS.has(value), `semantic_block_invalid_tag:${id}:${tagIdx}`);
      return value;
    });
    return {
      id,
      version,
      block_type: blockType,
      family,
      primary_semantic: primarySemantic,
      semantic_tags: semanticTags,
      user_question: userQuestion,
      dominant_action: dominantAction,
      tier,
    };
  });
  ensureUnique(semanticBlockList, "id", "semantic_block");

  const semanticBlockById = new Map(semanticBlockList.map((item) => [item.id, item]));
  const recipeById = new Map(recipeList.map((item) => [item.id, item]));

  const blockManifestList = blockManifests.blocks.map((entry, idx) => {
    assert(isRecord(entry), `block_manifest_invalid_entry:${idx}`);
    const id = asNonEmptyString(entry.id);
    const version = asNonEmptyString(entry.version);
    const semanticBlockId = asNonEmptyString(entry.semantic_block_id);
    const semanticBlockVersion = asNonEmptyString(entry.semantic_block_version);
    const recipeId = asNonEmptyString(entry.recipe_id);
    const recipeVersion = asNonEmptyString(entry.recipe_version);
    const actionRole = asNonEmptyString(entry.action_role);
    const renderMode = asNonEmptyString(entry.render_mode);
    assert(id && version && semanticBlockId && semanticBlockVersion && recipeId && recipeVersion && actionRole, `block_manifest_invalid_fields:${idx}`);
    assert(VALID_ACTION_ROLES.has(actionRole), `block_manifest_invalid_action_role:${id}:${actionRole}`);
    if (renderMode) {
      assert(VALID_RENDER_MODES.has(renderMode), `block_manifest_invalid_render_mode:${id}:${renderMode}`);
    }

    const semanticBlock = semanticBlockById.get(semanticBlockId);
    assert(semanticBlock, `block_manifest_missing_semantic_block:${id}:${semanticBlockId}`);
    assert(semanticBlock.version === semanticBlockVersion, `block_manifest_semantic_version_mismatch:${id}`);

    const recipe = recipeById.get(recipeId);
    assert(recipe, `block_manifest_missing_recipe:${id}:${recipeId}`);
    assert(recipe.version === recipeVersion, `block_manifest_recipe_version_mismatch:${id}`);

    return {
      id,
      version,
      semantic_block_id: semanticBlockId,
      semantic_block_version: semanticBlockVersion,
      recipe_id: recipeId,
      recipe_version: recipeVersion,
      action_role: actionRole,
      render_mode: renderMode ?? "visual",
      component_families: Array.isArray(entry.component_families)
        ? entry.component_families.filter((item) => typeof item === "string")
        : [],
      default_props: isRecord(entry.default_props) ? entry.default_props : {},
    };
  });
  ensureUnique(blockManifestList, "id", "block_manifest");

  const tokenPackById = new Map(tokenPackList.map((item) => [item.id, item]));
  const modePackById = new Map(modePackList.map((item) => [item.id, item]));
  const branchOverlayById = new Map(branchOverlayList.map((item) => [item.id, item]));
  const blockManifestById = new Map(blockManifestList.map((item) => [item.id, item]));

  const screenList = screens.manifests.map((entry, idx) => {
    assert(isRecord(entry), `screen_manifest_invalid_entry:${idx}`);
    const id = asNonEmptyString(entry.id);
    const version = asNonEmptyString(entry.version);
    const routeKey = asNonEmptyString(entry.route_key);
    const archetype = asNonEmptyString(entry.archetype);
    const mode = asNonEmptyString(entry.mode);
    const branch = asNonEmptyString(entry.branch);
    const tokenPackId = asNonEmptyString(entry.token_pack_id);
    const modePackId = asNonEmptyString(entry.mode_pack_id);
    const branchOverlayId = asNonEmptyString(entry.branch_overlay_id);

    assert(id && version && routeKey && archetype && mode && branch && tokenPackId && modePackId && branchOverlayId, `screen_manifest_invalid_fields:${idx}`);
    assert(VALID_ROUTES.has(routeKey), `screen_manifest_invalid_route:${id}:${routeKey}`);
    assert(archetypeBindings.contractByArchetype.has(archetype), `screen_manifest_invalid_archetype:${id}:${archetype}`);
    assert(VALID_MODES.has(mode), `screen_manifest_invalid_mode:${id}:${mode}`);
    assert(VALID_BRANCHES.has(branch), `screen_manifest_invalid_branch:${id}:${branch}`);
    assert(tokenPackById.has(tokenPackId), `screen_manifest_missing_token_pack:${id}:${tokenPackId}`);
    assert(modePackById.has(modePackId), `screen_manifest_missing_mode_pack:${id}:${modePackId}`);
    assert(branchOverlayById.has(branchOverlayId), `screen_manifest_missing_branch_overlay:${id}:${branchOverlayId}`);

    assert(Array.isArray(entry.blocks) && entry.blocks.length > 0, `screen_manifest_invalid_blocks:${id}`);
    const blocks = entry.blocks.map((block, blockIdx) => {
      assert(isRecord(block), `screen_manifest_invalid_block:${id}:${blockIdx}`);
      const blockId = asNonEmptyString(block.id);
      const blockManifestId = asNonEmptyString(block.block_manifest_id);
      const blockManifestVersion = asNonEmptyString(block.block_manifest_version);
      assert(blockId, `screen_manifest_invalid_block_fields:${id}:${blockIdx}`);
      assert(blockManifestId && blockManifestVersion, `screen_manifest_missing_block_manifest_ref:${id}:${blockId}`);

      const blockManifest = blockManifestById.get(blockManifestId);
      assert(blockManifest, `screen_manifest_missing_block_manifest:${id}:${blockManifestId}`);
      assert(blockManifest.version === blockManifestVersion, `screen_manifest_block_manifest_version_mismatch:${id}:${blockId}`);

      return {
        id: blockId,
        block_manifest_id: blockManifestId,
        block_manifest_version: blockManifestVersion,
        props: isRecord(block.props) ? block.props : {},
      };
    });

    const canonBlockManifests = blocks
      .map((block) => (block.block_manifest_id ? blockManifestById.get(block.block_manifest_id) : null))
      .filter(Boolean);
    const canonSemanticBlocks = canonBlockManifests.map((block) => semanticBlockById.get(block.semantic_block_id)).filter(Boolean);

    if (canonBlockManifests.length > 0) {
      enforceCanonForScreen(
        {
          id,
          archetype,
        },
        canonBlockManifests,
        canonSemanticBlocks,
        archetypeBindings
      );
    }

    return {
      id,
      version,
      route_key: routeKey,
      archetype,
      mode,
      branch,
      token_pack_id: tokenPackId,
      mode_pack_id: modePackId,
      branch_overlay_id: branchOverlayId,
      blocks,
    };
  });
  ensureUnique(screenList, "id", "screen_manifest");

  const screenById = new Map(screenList.map((item) => [item.id, item]));

  const experimentList = experiments.experiments.map((entry, idx) => {
    assert(isRecord(entry), `experiment_invalid_entry:${idx}`);
    const id = asNonEmptyString(entry.id);
    const key = asNonEmptyString(entry.key);
    const version = asNonEmptyString(entry.version);
    const status = asNonEmptyString(entry.status);
    const routeKey = asNonEmptyString(entry.route_key);
    const defaultVariant = asNonEmptyString(entry.default_variant);

    assert(id && key && version && status && routeKey && defaultVariant, `experiment_invalid_fields:${idx}`);
    assert(VALID_EXPERIMENT_STATUS.has(status), `experiment_invalid_status:${key}:${status}`);
    assert(VALID_ROUTES.has(routeKey), `experiment_invalid_route:${key}:${routeKey}`);

    assert(Array.isArray(entry.variants) && entry.variants.length > 0, `experiment_invalid_variants:${key}`);
    const variants = entry.variants.map((variant, variantIdx) => {
      assert(isRecord(variant), `experiment_invalid_variant:${key}:${variantIdx}`);
      const variantKey = asNonEmptyString(variant.key);
      const screenManifestId = asNonEmptyString(variant.screen_manifest_id);
      const weight = Number(variant.weight);
      assert(variantKey && screenManifestId, `experiment_invalid_variant_fields:${key}:${variantIdx}`);
      assert(Number.isFinite(weight) && weight > 0, `experiment_invalid_variant_weight:${key}:${variantKey}`);
      const screen = screenById.get(screenManifestId);
      assert(screen, `experiment_variant_missing_screen:${key}:${screenManifestId}`);
      assert(screen.route_key === routeKey, `experiment_variant_route_mismatch:${key}:${variantKey}:${screen.route_key}`);
      return {
        key: variantKey,
        weight,
        screen_manifest_id: screenManifestId,
      };
    });

    assert(variants.some((variant) => variant.key === defaultVariant), `experiment_default_variant_missing:${key}:${defaultVariant}`);
    ensureUnique(variants, "key", `experiment_variant:${key}`);

    return {
      id,
      key,
      version,
      status,
      route_key: routeKey,
      default_variant: defaultVariant,
      variants,
    };
  });

  ensureUnique(experimentList, "id", "experiment");
  ensureUnique(experimentList, "key", "experiment");

  for (const [routeKey, defaultScreenId] of Object.entries(DEFAULT_SCREEN_BY_ROUTE)) {
    const screen = screenById.get(defaultScreenId);
    assert(screen, `default_screen_missing:${routeKey}:${defaultScreenId}`);
  }

  return {
    tokenPacks: tokenPackList,
    modePacks: modePackList,
    branchOverlays: branchOverlayList,
    recipes: recipeList,
    semanticBlocks: semanticBlockList,
    blockManifests: blockManifestList,
    funnelContent,
    screens: screenList,
    experiments: experimentList,
    archetypeContracts: archetypeContracts.contracts,
    byId: {
      tokenPack: tokenPackById,
      modePack: modePackById,
      branchOverlay: branchOverlayById,
      recipe: recipeById,
      semanticBlock: semanticBlockById,
      blockManifest: blockManifestById,
      screen: screenById,
    },
  };
}

function mergeTokens(...sources) {
  const out = {};
  for (const source of sources) {
    if (!source) continue;
    for (const [key, value] of Object.entries(source)) {
      out[key] = value;
    }
  }
  return out;
}

function firstScreenByRoute(screens, routeKey) {
  return screens.find((screen) => screen.route_key === routeKey) ?? null;
}

export function resolveScreenForRoute(validationResult, routeKey, assignments = {}) {
  const routeExperiments = validationResult.experiments.filter(
    (experiment) => experiment.status === "active" && experiment.route_key === routeKey
  );

  let selectedScreen = null;
  let experimentResolution = null;

  if (routeExperiments.length > 0) {
    const experiment = routeExperiments[0];
    const assignment = assignments[experiment.key] ?? null;
    const variantKey = assignment?.variant_key;
    const variant = experiment.variants.find((item) => item.key === variantKey) ?? null;

    if (variant) {
      selectedScreen = validationResult.byId.screen.get(variant.screen_manifest_id) ?? null;
      if (selectedScreen) {
        experimentResolution = {
          experiment_key: experiment.key,
          variant_key: variant.key,
          source: assignment?.source ?? "default",
        };
      }
    }
  }

  if (!selectedScreen) {
    const defaultId = DEFAULT_SCREEN_BY_ROUTE[routeKey];
    selectedScreen = validationResult.byId.screen.get(defaultId) ?? firstScreenByRoute(validationResult.screens, routeKey);
  }

  assert(selectedScreen, `resolve_screen_not_found:${routeKey}`);

  const tokenPack = validationResult.byId.tokenPack.get(selectedScreen.token_pack_id);
  const modePack = validationResult.byId.modePack.get(selectedScreen.mode_pack_id);
  const branchOverlay = validationResult.byId.branchOverlay.get(selectedScreen.branch_overlay_id);

  assert(tokenPack, `resolve_token_pack_missing:${selectedScreen.id}`);
  assert(modePack, `resolve_mode_pack_missing:${selectedScreen.id}`);
  assert(branchOverlay, `resolve_branch_overlay_missing:${selectedScreen.id}`);

  const blocks = selectedScreen.blocks.map((block) => {
    const blockManifest = validationResult.byId.blockManifest.get(block.block_manifest_id);
    assert(blockManifest, `resolve_block_manifest_missing:${selectedScreen.id}:${block.id}`);
    const semanticBlock = blockManifest ? validationResult.byId.semanticBlock.get(blockManifest.semantic_block_id) : null;
    const recipeId = blockManifest?.recipe_id;
    const recipe = recipeId ? validationResult.byId.recipe.get(recipeId) : null;
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

  for (const block of blocks) {
    assert(block.recipe, `resolve_recipe_missing:${selectedScreen.id}:${block.id}`);
  }

  return {
    screen: selectedScreen,
    tokens: mergeTokens(tokenPack.tokens, modePack.tokens, branchOverlay.tokens),
    blocks,
    experimentResolution,
  };
}

function sortPlainObject(value) {
  if (Array.isArray(value)) {
    return value.map((item) => sortPlainObject(item));
  }
  if (!isRecord(value)) {
    return value;
  }

  const out = {};
  for (const key of Object.keys(value).sort()) {
    out[key] = sortPlainObject(value[key]);
  }
  return out;
}

export function stableStringify(value) {
  return JSON.stringify(sortPlainObject(value), null, 2);
}

export function summarizeValidation(validationResult) {
  return {
    token_packs: validationResult.tokenPacks.length,
    mode_packs: validationResult.modePacks.length,
    branch_overlays: validationResult.branchOverlays.length,
    recipes: validationResult.recipes.length,
    semantic_blocks: validationResult.semanticBlocks.length,
    block_manifests: validationResult.blockManifests.length,
    funnel_content_routes: Object.keys(validationResult.funnelContent?.content ?? {}).length,
    screens: validationResult.screens.length,
    experiments: validationResult.experiments.length,
    archetype_contracts: validationResult.archetypeContracts.length,
  };
}
