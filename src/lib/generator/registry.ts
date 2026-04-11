import tokenPacksJson from "../../../data/generator/token_packs.json";
import modePacksJson from "../../../data/generator/mode_packs.json";
import branchOverlaysJson from "../../../data/generator/branch_overlays.json";
import recipesJson from "../../../data/generator/component_recipes.json";
import semanticBlocksJson from "../../../data/generator/semantic_block_layer.json";
import blockManifestsJson from "../../../data/generator/block_manifests.json";
import screenManifestsJson from "../../../data/generator/screen_manifests.json";
import experimentsJson from "../../../data/generator/experiment_manifests.json";
import archetypeContractsJson from "../../../data/generator/archetype_contracts_v0_1.json";
import type {
  ArchetypeContractsManifest,
  BlockManifest,
  BranchOverlayManifest,
  ComponentRecipeManifest,
  ExperimentManifest,
  ModePackManifest,
  ScreenManifest,
  SemanticBlockManifest,
  TokenPackManifest,
} from "@/lib/generator/types";
import {
  enforceCanonicalIntegrity,
  validateArchetypeContracts,
  validateBlockManifests,
  validateBranchOverlays,
  validateExperiments,
  validateModePacks,
  validateRecipes,
  validateSemanticBlocks,
  validateScreens,
  validateTokenPacks,
} from "@/lib/generator/validators";

function indexById<T extends { id: string }>(items: T[]): Map<string, T> {
  const out = new Map<string, T>();
  for (const item of items) {
    out.set(item.id, item);
  }
  return out;
}

const tokenPacks = validateTokenPacks(tokenPacksJson);
const modePacks = validateModePacks(modePacksJson);
const branchOverlays = validateBranchOverlays(branchOverlaysJson);
const recipes = validateRecipes(recipesJson);
const semanticBlocks = validateSemanticBlocks(semanticBlocksJson);
const blockManifests = validateBlockManifests(blockManifestsJson);
const screenManifests = validateScreens(screenManifestsJson);
const experiments = validateExperiments(experimentsJson);
const archetypeContracts = validateArchetypeContracts(archetypeContractsJson);
enforceCanonicalIntegrity(screenManifests, blockManifests, semanticBlocks, recipes);

const tokenPackMap = indexById(tokenPacks);
const modePackMap = indexById(modePacks);
const branchOverlayMap = indexById(branchOverlays);
const recipeMap = indexById(recipes);
const semanticBlockMap = indexById(semanticBlocks);
const blockManifestMap = indexById(blockManifests);
const screenManifestMap = indexById(screenManifests);

export function getTokenPacks(): TokenPackManifest[] {
  return tokenPacks;
}

export function getModePacks(): ModePackManifest[] {
  return modePacks;
}

export function getBranchOverlays(): BranchOverlayManifest[] {
  return branchOverlays;
}

export function getRecipes(): ComponentRecipeManifest[] {
  return recipes;
}

export function getSemanticBlocks(): SemanticBlockManifest[] {
  return semanticBlocks;
}

export function getBlockManifests(): BlockManifest[] {
  return blockManifests;
}

export function getScreenManifests(): ScreenManifest[] {
  return screenManifests;
}

export function getExperiments(): ExperimentManifest[] {
  return experiments;
}

export function getArchetypeContracts(): ArchetypeContractsManifest {
  return archetypeContracts;
}

export function findTokenPackById(id: string): TokenPackManifest | null {
  return tokenPackMap.get(id) ?? null;
}

export function findModePackById(id: string): ModePackManifest | null {
  return modePackMap.get(id) ?? null;
}

export function findBranchOverlayById(id: string): BranchOverlayManifest | null {
  return branchOverlayMap.get(id) ?? null;
}

export function findRecipeById(id: string): ComponentRecipeManifest | null {
  return recipeMap.get(id) ?? null;
}

export function findSemanticBlockById(id: string): SemanticBlockManifest | null {
  return semanticBlockMap.get(id) ?? null;
}

export function findBlockManifestById(id: string): BlockManifest | null {
  return blockManifestMap.get(id) ?? null;
}

export function findScreenManifestById(id: string): ScreenManifest | null {
  return screenManifestMap.get(id) ?? null;
}
