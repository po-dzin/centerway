import type { ExperimentManifest, ExperimentResolution, ScreenRouteKey } from "@/lib/generator/types";

export const CW_EXPERIMENT_ASSIGNMENTS_HEADER = "x-cw-exp-assignments";

const EXPERIMENT_OVERRIDE_PREFIX = "exp_";
const EXPERIMENT_COOKIE_PREFIX = "cw_exp_";
const EXPERIMENT_SEED_COOKIE = "cw_ab_seed";

type ResolveExperimentInput = {
  routeKey: ScreenRouteKey;
  experiments: ExperimentManifest[];
  searchParams: URLSearchParams;
  cookies: Map<string, string>;
};

export type ResolveExperimentOutput = {
  assignments: Record<string, ExperimentResolution>;
  cookieMutations: Array<{ name: string; value: string }>;
};

function parseCookieValue(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function fnv1a(input: string): number {
  let hash = 2166136261;
  for (let idx = 0; idx < input.length; idx += 1) {
    hash ^= input.charCodeAt(idx);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function randomSeed(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `seed_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function pickVariantByWeight(experiment: ExperimentManifest, seed: string): string {
  const total = experiment.variants.reduce((acc, variant) => acc + variant.weight, 0);
  if (total <= 0) return experiment.default_variant;

  const hash = fnv1a(`${seed}:${experiment.key}`);
  const bucket = hash % total;

  let cursor = 0;
  for (const variant of experiment.variants) {
    cursor += variant.weight;
    if (bucket < cursor) return variant.key;
  }

  return experiment.default_variant;
}

function hasVariant(experiment: ExperimentManifest, variantKey: string): boolean {
  return experiment.variants.some((variant) => variant.key === variantKey);
}

export function parseCookieHeader(rawCookieHeader: string | null): Map<string, string> {
  const out = new Map<string, string>();
  if (!rawCookieHeader) return out;

  for (const cookieChunk of rawCookieHeader.split(";")) {
    const [rawName, ...rest] = cookieChunk.split("=");
    const name = rawName.trim();
    if (!name) continue;
    const value = rest.join("=").trim();
    try {
      out.set(name, decodeURIComponent(value));
    } catch {
      out.set(name, value);
    }
  }

  return out;
}

export function resolveExperimentAssignments(input: ResolveExperimentInput): ResolveExperimentOutput {
  const routeExperiments = input.experiments.filter(
    (experiment) => experiment.status === "active" && experiment.route_key === input.routeKey
  );

  const cookieMutations: Array<{ name: string; value: string }> = [];
  let seed = parseCookieValue(input.cookies.get(EXPERIMENT_SEED_COOKIE));
  if (!seed) {
    seed = randomSeed();
    cookieMutations.push({ name: EXPERIMENT_SEED_COOKIE, value: seed });
  }

  const assignments: Record<string, ExperimentResolution> = {};

  for (const experiment of routeExperiments) {
    const overrideKey = `${EXPERIMENT_OVERRIDE_PREFIX}${experiment.key}`;
    const overrideVariant = parseCookieValue(input.searchParams.get(overrideKey) ?? undefined);

    const cookieKey = `${EXPERIMENT_COOKIE_PREFIX}${experiment.key}`;
    const cookieVariant = parseCookieValue(input.cookies.get(cookieKey));

    let resolvedVariant = experiment.default_variant;
    let source: ExperimentResolution["source"] = "default";

    if (overrideVariant && hasVariant(experiment, overrideVariant)) {
      resolvedVariant = overrideVariant;
      source = "override";
    } else if (cookieVariant && hasVariant(experiment, cookieVariant)) {
      resolvedVariant = cookieVariant;
      source = "cookie";
    } else {
      resolvedVariant = pickVariantByWeight(experiment, seed);
      source = "bucket";
    }

    assignments[experiment.key] = {
      experiment_key: experiment.key,
      variant_key: resolvedVariant,
      source,
    };

    cookieMutations.push({ name: cookieKey, value: resolvedVariant });
  }

  return {
    assignments,
    cookieMutations,
  };
}

export function encodeExperimentAssignmentsHeader(assignments: Record<string, ExperimentResolution>): string {
  return JSON.stringify(assignments);
}

export function decodeExperimentAssignmentsHeader(rawValue: string | null): Record<string, ExperimentResolution> {
  if (!rawValue) return {};
  try {
    const parsed = JSON.parse(rawValue) as Record<string, ExperimentResolution>;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed;
  } catch {
    return {};
  }
}
