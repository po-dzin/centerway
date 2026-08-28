import { PLATFORM_GROUND, PLATFORM_GROUND_DARK } from "@/lib/platform/chrome";

/**
 * The public platform's light/dark switch — one decision, written down once.
 *
 * THREE CHOICES, TWO THEMES. `system` is not a third palette; it is the
 * absence of a choice, and it resolves through `prefers-color-scheme` on every
 * load and whenever the OS flips underneath an open tab. Storing the RESOLVED
 * theme instead would freeze a reader into whatever their laptop happened to
 * be at the moment they first arrived.
 *
 * THE ATTRIBUTE IS ALWAYS STAMPED, both values, never absent. globals.css
 * keys the dark palette off `[data-cw-theme="dark"]` and keys the course packs
 * off `:root:not([data-cw-theme="dark"])`, and those two only stay in step if
 * exactly one source writes the attribute. A `@media (prefers-color-scheme)`
 * rule beside them would be a second source: it would have to be repeated in
 * every pack selector, and the first time one of the two moved they would
 * disagree about what a course looks like at night. So the media query lives
 * HERE, in one line of script, and the stylesheet answers to one selector.
 *
 * Without JavaScript nothing is stamped and the page is light — which is what
 * every public page was before this shipped, so the no-JS reader loses nothing.
 *
 * `.dark` is NOT written here. That class is admin chrome, owned by
 * ThemeSwitcher, and it survives a client-side navigation out of /admin onto
 * public routes; keying the public palette off it would darken the whole site
 * for anyone who had once opened the admin. The two scopes stay separate on
 * purpose — see the comment beside them in globals.css.
 */
export const THEME_CHOICES = ["light", "dark", "system"] as const;

export type ThemeChoice = (typeof THEME_CHOICES)[number];

export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "cw-theme";

export const DEFAULT_THEME_CHOICE: ThemeChoice = "system";

export const THEME_LABELS: Record<ThemeChoice, string> = {
  light: "Світла",
  dark: "Темна",
  system: "Системна",
};

export function isThemeChoice(value: unknown): value is ThemeChoice {
  return typeof value === "string" && (THEME_CHOICES as readonly string[]).includes(value);
}

export function readThemeChoice(): ThemeChoice {
  if (typeof window === "undefined") return DEFAULT_THEME_CHOICE;
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemeChoice(stored) ? stored : DEFAULT_THEME_CHOICE;
  } catch {
    // A private window can refuse storage. The choice is then this session's
    // only, which is better than the page failing to theme itself at all.
    return DEFAULT_THEME_CHOICE;
  }
}

export function systemTheme(): ResolvedTheme {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function resolveTheme(choice: ThemeChoice): ResolvedTheme {
  return choice === "system" ? systemTheme() : choice;
}

/**
 * Put a resolved theme on the document.
 *
 * Three writes, and each one is load-bearing:
 *  - `data-cw-theme` is the palette selector.
 *  - `color-scheme` is what makes the browser's OWN painting agree — form
 *    controls, scrollbars, and the canvas behind an overscroll. Without it a
 *    dark page scrolls past its own end into white.
 *  - `theme-color` is the surround: address bar, iOS status bar, and the
 *    installed window's title bar.
 */
export function applyPlatformTheme(theme: ResolvedTheme): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.dataset.cwTheme = theme;
  root.style.colorScheme = theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", theme === "dark" ? PLATFORM_GROUND_DARK : PLATFORM_GROUND);
}

/**
 * The same three writes, as a string, to run BEFORE first paint.
 *
 * It is inlined in the route-group roots rather than imported, because a
 * module would arrive after the first frame and the reader would watch a cream
 * page turn graphite — the flash this exists to prevent. Kept deliberately
 * small and dependency-free for the same reason, and wrapped in try/catch
 * because a private window throws on `localStorage` and a page that cannot
 * read a preference must still render.
 *
 * The values are interpolated from the constants above so this cannot drift
 * from `applyPlatformTheme`; nothing here is attacker-controlled.
 */
export const THEME_BOOT_SCRIPT = [
  "(function(){var c;",
  `try{c=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});}catch(e){}`,
  'if(c!=="light"&&c!=="dark"){try{c=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";}catch(e){c="light";}}',
  'var r=document.documentElement;r.setAttribute("data-cw-theme",c);r.style.colorScheme=c;',
  'var m=document.querySelector(\'meta[name="theme-color"]\');',
  `if(m)m.setAttribute("content",c==="dark"?${JSON.stringify(PLATFORM_GROUND_DARK)}:${JSON.stringify(
    PLATFORM_GROUND
  )});})();`,
].join("");
