export type CWThemeFamily =
  | "quiet-mineral"
  | "living-mineral"
  | "warm-route"
  | "warm-mineral"
  | "natural-premium"
  | "natural3"
  | "curcuma";
export type CWMode = "consult" | "detox" | "herbs" | "lesson" | "dashboard" | "support" | "admin";
export type CWBranch = "consult" | "detox" | "herbs" | "short" | "irem" | "platform";
export type CWSemanticFamily = "calm" | "method" | "guide" | "trust" | "progress" | "organic" | "embodied" | "boundary";
export type CWSemanticBlockGroup =
  | "orientation"
  | "offer_route"
  | "method_explanation"
  | "trust_proof_expectation"
  | "support_care"
  | "progress_pathway"
  | "boundary_caution";

export type CWDensity = "air" | "balanced" | "compact" | "tight";
export type CWShapeProfile = "soft" | "balanced" | "route-structured";
export type CWSurfaceDepth = "flat" | "soft-elevated" | "layered";
export type CWPatternStyle = "plain" | "rail" | "route-line" | "chip" | "layered";

export type CWGeneratorConfig = {
  theme: {
    family: CWThemeFamily;
    baseTemperature: "cool-neutral" | "balanced" | "warm-neutral";
    routeAccent: "teal" | "copper" | "olive-teal";
    organicDepth: "low" | "medium" | "high";
    embodiedWarmth: "low" | "medium" | "high";
  };
  mode: CWMode;
  branch?: CWBranch;
  grid: {
    columnsDesktop: 8 | 10 | 12;
    contentMax: 720 | 840 | 960 | 1120;
    gutter: "tight" | "balanced" | "airy";
  };
  density: {
    mode: CWDensity;
  };
  shape: {
    profile: CWShapeProfile;
    radiusScale: "low" | "medium" | "high";
  };
  surface: {
    depth: CWSurfaceDepth;
    contrast: "low" | "balanced" | "medium-high";
  };
  pattern: {
    cardStyle: "plain" | "bordered" | "rail" | "layered";
    routeMarking: "node" | "line" | "chip" | "step-bar";
  };
};

export type ScreenRouteKey = "consult" | "detox" | "herbs" | "dosha-test" | "lesson-pilot";

export type SemanticBlockManifest = {
  id: string;
  version: string;
  block_type: string;
  family: CWSemanticBlockGroup;
  primary_semantic: CWSemanticFamily;
  semantic_tags: CWSemanticFamily[];
  user_question: string;
  dominant_action: string;
  tier: "tier1" | "tier2" | "tier3";
};

export type BlockManifest = {
  id: string;
  version: string;
  semantic_block_id: string;
  semantic_block_version: string;
  recipe_id: string;
  recipe_version: string;
  action_role: "primary" | "support" | "none";
  render_mode?: "visual" | "semantic-only";
  component_families?: string[];
  default_props: Record<string, unknown>;
};

export type TokenPackManifest = {
  id: string;
  version: string;
  theme_family: CWThemeFamily;
  tokens: Record<`--${string}`, string>;
};

export type ModePackManifest = {
  id: string;
  version: string;
  mode: CWMode;
  tokens: Record<`--${string}`, string>;
};

export type BranchOverlayManifest = {
  id: string;
  version: string;
  branch: CWBranch;
  tokens: Record<`--${string}`, string>;
};

export type ComponentRecipeManifest = {
  id: string;
  version: string;
  component_key: string;
};

export type ScreenBlockManifest = {
  id: string;
  block_manifest_id: string;
  block_manifest_version: string;
  props?: Record<string, unknown>;
};

export type ScreenManifest = {
  id: string;
  version: string;
  route_key: ScreenRouteKey;
  archetype: ArchetypeContract["archetype"];
  mode: CWMode;
  branch: CWBranch;
  token_pack_id: string;
  mode_pack_id: string;
  branch_overlay_id: string;
  blocks: ScreenBlockManifest[];
};

export type ExperimentVariantManifest = {
  key: string;
  weight: number;
  screen_manifest_id: string;
};

export type ExperimentManifest = {
  id: string;
  key: string;
  version: string;
  status: "active" | "paused";
  route_key: ScreenRouteKey;
  default_variant: string;
  variants: ExperimentVariantManifest[];
};

export type ExperimentSource = "bucket" | "override" | "cookie" | "default";

export type ExperimentResolution = {
  experiment_key: string;
  variant_key: string;
  source: ExperimentSource;
};

export type ResolvedGeneratedScreen = {
  screen: ScreenManifest;
  blocks: Array<{
    id: string;
    block: BlockManifest | null;
    semanticBlock: SemanticBlockManifest | null;
    recipe: ComponentRecipeManifest;
    props: Record<string, unknown>;
  }>;
  tokens: Record<`--${string}`, string>;
  tokenPackId: string;
  themeFamily: CWThemeFamily;
  experimentResolution?: ExperimentResolution;
};

export type PrimaryCTACardinality = "1" | "0..1" | "1..N" | "0";

export type ArchetypeContract = {
  archetype:
    | "overview-entry"
    | "offer-detail"
    | "intent-checkout"
    | "lesson-practice"
    | "dashboard-route"
    | "support-proof"
    | "overlay-modal"
    | "admin-utility";
  primaryCTA: PrimaryCTACardinality;
  primary_cta_repetition?: PrimaryCTACardinality;
  semanticBlocks: {
    required: string[];
    optional: string[];
    conditional: string[];
    forbidden?: string[];
  };
  componentFamilies: {
    required: string[];
    optional: string[];
    conditional: string[];
    forbidden?: string[];
  };
  rules: string[];
};

export type ArchetypeContractsManifest = {
  schema_version: string;
  spec: string;
  spec_version: string;
  archetype_registry: ArchetypeContract["archetype"][];
  engine_bindings?: {
    archetype_aliases?: Record<string, ArchetypeContract["archetype"]>;
    required_semantics_by_contract?: Partial<Record<ArchetypeContract["archetype"], CWSemanticFamily[]>>;
  };
  contracts: ArchetypeContract[];
  ordered_sequences?: Record<string, string[]>;
  assembly_constraints?: string[];
};
