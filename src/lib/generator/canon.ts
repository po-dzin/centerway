import archetypeContractsJson from "../../../data/generator/archetype_contracts_v0_1.json";
import type {
  ArchetypeContract,
  ArchetypeContractsManifest,
  BlockManifest,
  CWSemanticFamily,
  PrimaryCTACardinality,
  ScreenManifest,
  SemanticBlockManifest,
} from "@/lib/generator/types";

function cardinalityToRange(value: PrimaryCTACardinality): { min: number; max: number } {
  switch (value) {
    case "0":
      return { min: 0, max: 0 };
    case "0..1":
      return { min: 0, max: 1 };
    case "1..N":
      return { min: 1, max: Number.MAX_SAFE_INTEGER };
    case "1":
    default:
      return { min: 1, max: 1 };
  }
}

function primaryActionRange(contract: ArchetypeContract): { min: number; max: number } {
  const strict = cardinalityToRange(contract.primaryCTA);
  if (!contract.primary_cta_repetition) return strict;
  const repeated = cardinalityToRange(contract.primary_cta_repetition);
  return {
    min: Math.max(strict.min, repeated.min),
    max: Math.max(strict.max, repeated.max),
  };
}

function asObject(input: unknown): Record<string, unknown> | null {
  return input && typeof input === "object" && !Array.isArray(input) ? (input as Record<string, unknown>) : null;
}

function asStringArray(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input.filter((item): item is string => typeof item === "string" && item.length > 0);
}

function parseArchetypeContracts(): {
  contractByArchetype: Map<ArchetypeContract["archetype"], ArchetypeContract>;
  requiredSemanticsByContract: Partial<Record<ArchetypeContract["archetype"], CWSemanticFamily[]>>;
} {
  const raw = archetypeContractsJson as unknown;
  const doc = asObject(raw) as ArchetypeContractsManifest | null;

  const contractByArchetype = new Map<ArchetypeContract["archetype"], ArchetypeContract>();
  if (doc?.contracts && Array.isArray(doc.contracts)) {
    for (const contract of doc.contracts) {
      if (contract?.archetype) {
        contractByArchetype.set(contract.archetype, contract);
      }
    }
  }

  const bindings = asObject(doc?.engine_bindings);
  const semanticsInput = asObject(bindings?.required_semantics_by_contract);

  const requiredSemanticsByContract: Partial<Record<ArchetypeContract["archetype"], CWSemanticFamily[]>> = {};
  if (semanticsInput) {
    for (const [archetype, semantics] of Object.entries(semanticsInput)) {
      if (!contractByArchetype.has(archetype as ArchetypeContract["archetype"])) continue;
      requiredSemanticsByContract[archetype as ArchetypeContract["archetype"]] = asStringArray(semantics) as CWSemanticFamily[];
    }
  }

  return { contractByArchetype, requiredSemanticsByContract };
}

const contracts = parseArchetypeContracts();

function countPrimaryActions(blocks: BlockManifest[]): number {
  return blocks.filter((block) => block.action_role === "primary").length;
}

function normalizeCanonKey(value: string): string {
  return value.trim().toLowerCase().replace(/[_\s/]+/g, "-");
}

export function enforceCanonForScreen(
  screen: ScreenManifest,
  blocks: BlockManifest[],
  semanticBlocks: SemanticBlockManifest[]
): void {
  const canonicalArchetype = screen.archetype as ArchetypeContract["archetype"];
  const contract = contracts.contractByArchetype.get(canonicalArchetype);
  if (!contract) {
    throw new Error(`canon_unknown_archetype:${screen.id}:${screen.archetype}`);
  }
  const required = contracts.requiredSemanticsByContract[canonicalArchetype] ?? [];

  if (required.length > 0) {
    const semanticSet = new Set<CWSemanticFamily>();
    for (const semanticBlock of semanticBlocks) {
      semanticSet.add(semanticBlock.primary_semantic);
      for (const tag of semanticBlock.semantic_tags) {
        semanticSet.add(tag);
      }
    }

    for (const semantic of required) {
      if (!semanticSet.has(semantic)) {
        throw new Error(`canon_missing_semantic:${screen.id}:${screen.archetype}:${semantic}`);
      }
    }
  }

  const primaryRule = primaryActionRange(contract);
  const count = countPrimaryActions(blocks);
  if (count < primaryRule.min || count > primaryRule.max) {
    throw new Error(
      `canon_primary_action_invalid:${screen.id}:${screen.archetype}:expected_${primaryRule.min}_${primaryRule.max}:got_${count}`
    );
  }

  const semanticBlockTypes = new Set(semanticBlocks.map((block) => normalizeCanonKey(block.block_type)));
  for (const requiredBlock of contract.semanticBlocks.required) {
    const normalized = normalizeCanonKey(requiredBlock);
    if (!semanticBlockTypes.has(normalized)) {
      throw new Error(`canon_missing_required_block:${screen.id}:${screen.archetype}:${requiredBlock}`);
    }
  }

  for (const forbiddenBlock of contract.semanticBlocks.forbidden ?? []) {
    const normalized = normalizeCanonKey(forbiddenBlock);
    if (semanticBlockTypes.has(normalized)) {
      throw new Error(`canon_forbidden_block_present:${screen.id}:${screen.archetype}:${forbiddenBlock}`);
    }
  }

  const familySet = new Set<string>();
  for (const block of blocks) {
    for (const family of block.component_families ?? []) {
      familySet.add(normalizeCanonKey(family));
    }
  }

  for (const requiredFamily of contract.componentFamilies.required) {
    const normalized = normalizeCanonKey(requiredFamily);
    if (!familySet.has(normalized)) {
      throw new Error(`canon_missing_required_component_family:${screen.id}:${screen.archetype}:${requiredFamily}`);
    }
  }

  for (const forbiddenFamily of contract.componentFamilies.forbidden ?? []) {
    const normalized = normalizeCanonKey(forbiddenFamily);
    if (familySet.has(normalized)) {
      throw new Error(`canon_forbidden_component_family_present:${screen.id}:${screen.archetype}:${forbiddenFamily}`);
    }
  }

  const allowedFamilies = new Set<string>(
    [
      ...contract.componentFamilies.required,
      ...(contract.componentFamilies.optional ?? []),
      ...(contract.componentFamilies.conditional ?? []),
    ].map((value) => normalizeCanonKey(value))
  );

  for (const family of familySet) {
    if (!allowedFamilies.has(family)) {
      throw new Error(`canon_component_family_not_allowed:${screen.id}:${screen.archetype}:${family}`);
    }
  }
}
