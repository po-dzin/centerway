import tokenPacksJson from "../../../data/generator/token_packs.json";

type ThemeTokenPreview = {
  key: string;
  label: string;
  value: string;
};

export type ThemeCatalogEntry = {
  key: string;
  label: string;
  tokens: Record<`--${string}`, string>;
  preview: ThemeTokenPreview[];
};

const THEME_LABELS: Record<string, string> = {
  "warm-mineral": "Теплий мінерал",
  "living-mineral": "Живий мінерал",
  "natural-premium": "Натуральний преміум",
  natural3: "Натуральна 3",
  curcuma: "Куркума",
};

const PREVIEW_ROLES: Array<{ key: `--${string}`; label: string }> = [
  { key: "--cw-bg", label: "Фон" },
  { key: "--cw-text", label: "Текст" },
  { key: "--cw-accent", label: "Акцент маршруту" },
  { key: "--cw-status-success", label: "Успіх" },
  { key: "--cw-status-pending", label: "Очікування" },
  { key: "--cw-role-trust-proof-surface", label: "Доказ" },
  { key: "--cw-role-trust-policy-surface", label: "Межі" },
  { key: "--cw-role-support-surface", label: "Підтримка" },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeThemeLabel(key: string): string {
  return THEME_LABELS[key] ?? key;
}

function asTokenMap(value: unknown): Record<`--${string}`, string> {
  if (!isRecord(value)) return {};
  const out: Record<`--${string}`, string> = {};
  for (const [token, raw] of Object.entries(value)) {
    if (!token.startsWith("--")) continue;
    if (typeof raw !== "string") continue;
    out[token as `--${string}`] = raw;
  }
  return out;
}

function buildPreview(tokens: Record<`--${string}`, string>): ThemeTokenPreview[] {
  const out: ThemeTokenPreview[] = [];
  for (const role of PREVIEW_ROLES) {
    const value = tokens[role.key];
    if (!value) continue;
    out.push({
      key: role.key,
      label: role.label,
      value,
    });
  }
  return out;
}

const themeCatalog: ThemeCatalogEntry[] = (() => {
  const doc = tokenPacksJson as unknown;
  if (!isRecord(doc) || !Array.isArray(doc.packs)) return [];
  const out: ThemeCatalogEntry[] = [];
  for (const pack of doc.packs) {
    if (!isRecord(pack)) continue;
    const key = typeof pack.theme_family === "string" ? pack.theme_family.trim() : "";
    if (!key) continue;
    const tokens = asTokenMap(pack.tokens);
    out.push({
      key,
      label: normalizeThemeLabel(key),
      tokens,
      preview: buildPreview(tokens),
    });
  }
  return out;
})();

const themeKeySet = new Set(themeCatalog.map((item) => item.key));

export function getThemeCatalog(): ThemeCatalogEntry[] {
  return themeCatalog;
}

export function isKnownThemeKey(value: string | null | undefined): value is string {
  return typeof value === "string" && themeKeySet.has(value);
}
