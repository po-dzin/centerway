import type { ExperimentResolution, TokenPackManifest } from "@/lib/generator/types";

export const CW_THEME_SELECTION_HEADER = "x-cw-theme-selection";
export const CW_THEME_COOKIE = "cw_theme";
export const CW_THEME_QUERY_KEYS = ["cw_theme", "theme", "palette"] as const;

const THEME_ALIASES: Record<string, string> = {
  warm: "warm-mineral",
  "warm-route": "warm-mineral",
  living: "living-mineral",
  naturalpremium: "natural-premium",
  naturalpremiumv1: "natural-premium",
  natural: "natural-premium",
};

function normalizeToken(raw: string): string {
  return raw.trim().toLowerCase().replace(/[_\s.]+/g, "-");
}

function parsePackFamilyFromId(raw: string): string | null {
  if (!raw.startsWith("token_pack.")) return null;
  const parts = raw.split(".");
  if (parts.length < 3) return null;
  return normalizeToken(parts[1] ?? "");
}

function normalizeCandidate(rawValue: string): string {
  const normalized = normalizeToken(rawValue);
  return THEME_ALIASES[normalized] ?? normalized;
}

export function getThemeFromSearchParams(searchParams: URLSearchParams): string | null {
  for (const key of CW_THEME_QUERY_KEYS) {
    const value = searchParams.get(key);
    if (!value) continue;
    const normalized = normalizeCandidate(value);
    if (normalized.length > 0) return normalized;
  }
  return null;
}

function extractThemeFromVariantKey(variantKey: string, availableFamilies: Set<string>): string | null {
  const normalized = normalizeToken(variantKey);
  if (availableFamilies.has(normalized)) return normalized;

  for (const family of availableFamilies) {
    const familyNeedle = normalizeToken(family);
    if (normalized.includes(familyNeedle)) return family;
    if (normalized.includes(`theme-${familyNeedle}`)) return family;
    if (normalized.includes(`palette-${familyNeedle}`)) return family;
  }

  return null;
}

export function resolveTokenPackFromSelection(input: {
  defaultTokenPack: TokenPackManifest;
  tokenPacks: TokenPackManifest[];
  explicitSelection?: string | null;
  assignments?: Record<string, ExperimentResolution>;
}): TokenPackManifest {
  const { defaultTokenPack, tokenPacks, explicitSelection, assignments } = input;
  const byFamily = new Map(tokenPacks.map((pack) => [normalizeToken(pack.theme_family), pack] as const));
  const byId = new Map(tokenPacks.map((pack) => [pack.id, pack] as const));

  const explicit = explicitSelection ? normalizeCandidate(explicitSelection) : null;
  const explicitFromId = explicit ? parsePackFamilyFromId(explicit) : null;
  const explicitResolved = explicitFromId ?? explicit;
  if (explicitResolved) {
    const byFamilyMatch = byFamily.get(explicitResolved);
    if (byFamilyMatch) return byFamilyMatch;
    const byIdMatch = byId.get(explicitSelection ?? "");
    if (byIdMatch) return byIdMatch;
  }

  const availableFamilies = new Set(byFamily.keys());
  const fromVariant = Object.values(assignments ?? {}).find((assignment) =>
    extractThemeFromVariantKey(assignment.variant_key, availableFamilies)
  );
  if (fromVariant) {
    const family = extractThemeFromVariantKey(fromVariant.variant_key, availableFamilies);
    if (family) {
      const match = byFamily.get(family);
      if (match) return match;
    }
  }

  return defaultTokenPack;
}
