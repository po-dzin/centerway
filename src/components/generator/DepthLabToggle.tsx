"use client";

import { useEffect, useMemo, useState } from "react";
import { CW_THEME_COOKIE } from "@/lib/generator/theme";
import { getThemeCatalog, isKnownThemeKey } from "@/lib/generator/themeCatalog";

type DepthProfile = "flat" | "balanced" | "deep";
type ThemeKey = string;

const STORAGE_PROFILE = "cw_depth_profile";
const STORAGE_PERCENT = "cw_depth_percent";
const STORAGE_THEME = "cw_theme";
const QUERY_PROFILE = "cw_depth";
const QUERY_PERCENT = "cw_depth_pct";
const QUERY_THEME = "cw_theme";

const THEMES = getThemeCatalog();
const DEFAULT_THEME = THEMES.find((item) => item.key === "warm-mineral")?.key ?? THEMES[0]?.key ?? "warm-mineral";

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 70;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function readInitialProfile(): DepthProfile {
  if (typeof window === "undefined") return "balanced";
  const params = new URLSearchParams(window.location.search);
  const fromQuery = params.get(QUERY_PROFILE);
  if (fromQuery === "flat" || fromQuery === "balanced" || fromQuery === "deep") return fromQuery;

  const fromStorage = localStorage.getItem(STORAGE_PROFILE);
  if (fromStorage === "flat" || fromStorage === "balanced" || fromStorage === "deep") return fromStorage;
  return "balanced";
}

function readInitialPercent(): number {
  if (typeof window === "undefined") return 70;
  const params = new URLSearchParams(window.location.search);
  const fromQuery = params.get(QUERY_PERCENT);
  if (fromQuery) return clampPercent(Number.parseInt(fromQuery, 10));

  const fromStorage = localStorage.getItem(STORAGE_PERCENT);
  if (fromStorage) return clampPercent(Number.parseInt(fromStorage, 10));
  return 70;
}

function readInitialTheme(): ThemeKey {
  if (typeof window === "undefined") return DEFAULT_THEME;
  const params = new URLSearchParams(window.location.search);
  const fromQuery = params.get(QUERY_THEME);
  if (isKnownThemeKey(fromQuery)) return fromQuery;
  const fromStorage = localStorage.getItem(STORAGE_THEME);
  if (isKnownThemeKey(fromStorage)) return fromStorage;
  const fromDom = document.querySelector("[data-cw-theme]")?.getAttribute("data-cw-theme");
  if (isKnownThemeKey(fromDom)) return fromDom;
  return DEFAULT_THEME;
}

function setCssVar(name: string, value: string) {
  document.documentElement.style.setProperty(name, value);
}

function applyThemeCss(themeKey: ThemeKey) {
  const selectedTheme = THEMES.find((theme) => theme.key === themeKey);
  if (!selectedTheme) return;
  Object.entries(selectedTheme.tokens).forEach(([token, value]) => {
    setCssVar(token, value);
  });
  document.querySelector("[data-cw-theme]")?.setAttribute("data-cw-theme", themeKey);
}

function applyDepthCss(profile: DepthProfile, percent: number) {
  const p = clampPercent(percent) / 100;
  const profileScale = profile === "flat" ? 0.55 : profile === "deep" ? 1.45 : 1;

  const surfaceBlend = Math.round(95 - 9 * p * profileScale);
  const supportTint = Math.round(3 + 6 * p * profileScale);
  const proofTint = Math.round(4 + 7 * p * profileScale);
  const boundaryTint = Math.round(4 + 7 * p * profileScale);
  const grainOpacity = Math.min(0.06, 0.018 + 0.035 * p * profileScale);

  const cardShadowAlpha = Math.min(0.18, 0.05 + 0.09 * p * profileScale);
  const mediumShadowAlpha = Math.min(0.22, 0.08 + 0.11 * p * profileScale);
  const buttonShadowAlpha = Math.min(0.28, 0.12 + 0.12 * p * profileScale);

  setCssVar("--cw-depth-apply-pct", `${Math.round(p * 100)}%`);
  setCssVar("--cw-depth-grain-opacity", grainOpacity.toFixed(3));
  setCssVar("--cw-depth-card-bg", `color-mix(in srgb, var(--cw-surface) ${surfaceBlend}%, var(--cw-surface-2))`);
  setCssVar(
    "--cw-depth-support-bg",
    `color-mix(in srgb, var(--cw-depth-card-bg) ${100 - supportTint}%, var(--cw-role-support-surface) ${supportTint}%)`
  );
  setCssVar(
    "--cw-depth-proof-bg",
    `color-mix(in srgb, var(--cw-depth-card-bg) ${100 - proofTint}%, var(--cw-role-trust-proof-surface) ${proofTint}%)`
  );
  setCssVar(
    "--cw-depth-boundary-bg",
    `color-mix(in srgb, var(--cw-depth-card-bg) ${100 - boundaryTint}%, var(--cw-role-trust-policy-surface) ${boundaryTint}%)`
  );
  setCssVar(
    "--cw-depth-icon-slot-bg",
    `color-mix(in srgb, var(--cw-accent-soft) ${44 + Math.round(8 * p)}%, white ${56 - Math.round(8 * p)}%)`
  );
  setCssVar(
    "--cw-depth-shadow-soft",
    `0 12px 28px color-mix(in srgb, var(--cw-text) ${Math.round(cardShadowAlpha * 100)}%, transparent)`
  );
  setCssVar(
    "--cw-depth-shadow-medium",
    `0 16px 32px color-mix(in srgb, var(--cw-text) ${Math.round(mediumShadowAlpha * 100)}%, transparent)`
  );
  setCssVar(
    "--cw-depth-shadow-strong",
    `0 14px 28px color-mix(in srgb, var(--cw-accent) ${Math.round(buttonShadowAlpha * 100)}%, transparent)`
  );
  setCssVar("--cw-depth-support-tint", `${supportTint}%`);
}

function syncUrl(profile: DepthProfile, percent: number, theme: ThemeKey) {
  const url = new URL(window.location.href);
  url.searchParams.set(QUERY_PROFILE, profile);
  url.searchParams.set(QUERY_PERCENT, String(clampPercent(percent)));
  url.searchParams.set(QUERY_THEME, theme);
  window.history.replaceState(null, "", `${url.pathname}?${url.searchParams.toString()}${url.hash}`);
}

export function DepthLabToggle() {
  const [open, setOpen] = useState(false);
  const [profile, setProfile] = useState<DepthProfile>("balanced");
  const [percent, setPercent] = useState<number>(70);
  const [theme, setTheme] = useState<ThemeKey>(DEFAULT_THEME);
  const [expandedTheme, setExpandedTheme] = useState<ThemeKey | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // Keep first client render identical to SSR to avoid hydration mismatch.
    const initialProfile = readInitialProfile();
    const initialPercent = readInitialPercent();
    const initialTheme = readInitialTheme();
    queueMicrotask(() => {
      setProfile(initialProfile);
      setPercent(initialPercent);
      setTheme(initialTheme);
      setExpandedTheme(initialTheme);
      setHydrated(true);
    });
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    applyThemeCss(theme);
    applyDepthCss(profile, percent);
    localStorage.setItem(STORAGE_THEME, theme);
    document.cookie = `${CW_THEME_COOKIE}=${encodeURIComponent(theme)}; path=/; max-age=31536000; samesite=lax`;
    localStorage.setItem(STORAGE_PROFILE, profile);
    localStorage.setItem(STORAGE_PERCENT, String(clampPercent(percent)));
    syncUrl(profile, percent, theme);
  }, [hydrated, profile, percent, theme]);

  const label = useMemo(() => {
    const themeLabel = THEMES.find((item) => item.key === theme)?.label ?? theme;
    const profileLabel = profile === "flat" ? "плаский" : profile === "balanced" ? "збалансований" : "глибокий";
    return `${themeLabel} · ${profileLabel} · ${clampPercent(percent)}%`;
  }, [theme, profile, percent]);

  return (
    <div className={`cw-depth-lab ${open ? "is-open" : ""}`} data-open={open ? "1" : "0"}>
      <button
        type="button"
        className="cw-depth-lab-toggle"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        title={"Тема: " + label}
      >
        <span className="cw-depth-lab-toggle-dot" aria-hidden="true" style={{ background: "var(--cw-accent)" }} />
        <span className="cw-depth-lab-toggle-value">{clampPercent(percent)}%</span>
        <span className={`cw-depth-lab-toggle-chevron ${open ? "is-open" : ""}`} aria-hidden="true">
          ▾
        </span>
      </button>
      {open ? (
        <div className="cw-depth-lab-panel">
          <div className="cw-depth-lab-row">
            <span>Теми</span>
            <div className="cw-depth-theme-list" role="list">
      {THEMES.map((item) => {
                const isActive = theme === item.key;
                const isExpanded = expandedTheme === item.key;
                return (
                  <div key={item.key} className={`cw-depth-theme-item ${isActive ? "is-active" : ""}`}>
                    <button
                      type="button"
                      className="cw-depth-theme-trigger"
                      onClick={() => {
                        setTheme(item.key);
                        setExpandedTheme((prev) => (prev === item.key ? null : item.key));
                      }}
                      aria-expanded={isExpanded}
                    >
                      <span>{item.label}</span>
                      <span className="cw-depth-theme-dot" style={{ background: item.tokens["--cw-accent"] }} />
                    </button>
                    {isExpanded ? (
                      <div className="cw-depth-theme-preview">
                        {item.preview.map((token) => (
                          <div key={token.key} className="cw-depth-theme-swatch">
                            <span className="cw-depth-theme-chip" style={{ background: token.value }} />
                            <small>{token.label}</small>
                            <code>{token.value}</code>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
          <div className="cw-depth-lab-row">
            <span>Профіль</span>
            <div className="cw-depth-lab-segment" role="radiogroup" aria-label="Depth profile">
              {(["flat", "balanced", "deep"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={profile === value}
                  className={profile === value ? "is-active" : ""}
                  onClick={() => setProfile(value)}
                >
                  {value === "flat" ? "плаский" : value === "balanced" ? "збалансований" : "глибокий"}
                </button>
              ))}
            </div>
          </div>
          <div className="cw-depth-lab-row">
            <span>Підмішування</span>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={percent}
              onChange={(e) => setPercent(clampPercent(Number.parseInt(e.target.value, 10)))}
            />
            <strong>{clampPercent(percent)}%</strong>
          </div>
        </div>
      ) : null}
    </div>
  );
}
