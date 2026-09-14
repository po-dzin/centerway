import { PLATFORM_GROUND, PLATFORM_GROUND_DARK } from "@/lib/platform/chrome";
import { isPlatformDomain, SESSION_COOKIE_DOMAIN } from "@/lib/auth/sessionCookie";

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
 * THIS IS THE ONLY THEME WRITER IN THE PRODUCT (since 2026-08-28). The admin
 * used to run a second one — a `.dark` class on <html> under its own storage
 * key — which meant a surface with no boot script, no `color-scheme`, and a
 * light theme that could not work at all: /admin is inside the `(platform)`
 * route group, so the script below stamped the document anyway and the two
 * answers disagreed. The class is gone and the admin reads this store, so the
 * three things every other surface already had — no flash, the browser's own
 * painting in the right gamma, and a light theme — arrive there for free.
 *
 * THE CHOICE LIVES IN A COOKIE, not only in `localStorage` (since 2026-09-13).
 * `www.`, `my.` and `build.` are three different origins, and `localStorage`
 * is per-origin: a reader who picked dark on `www` landed light on `my` on
 * their very next click, because nothing carried the choice across. The same
 * shape already broke sign-in once — see `auth/sessionCookie.ts` — and the fix
 * is the same one: a cookie scoped to `SESSION_COOKIE_DOMAIN` is shared by
 * every surface under it, so `readCookieChoice`/`writeCookieChoice` mirror
 * `sessionCookieOptions` rather than inventing a second domain rule that could
 * drift from it. `localStorage` stays as a second write, not a replacement —
 * it is what makes `subscribeThemeChoice`'s `storage` listener fire for a
 * second tab open on the *same* origin; a cookie change alone does not raise
 * that event. It also carries an already-chosen theme into the cookie on the
 * first load after this shipped, in the boot script below, the same way
 * `adoptLegacySession` carries a session forward.
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

/**
 * The name of the same-tab notification. `storage` is the OTHER tab; this is
 * this one. Exported because more than one control renders at a time — the
 * footer, the account menu and the admin bar — and a switch that moves one and
 * leaves the others reads as the site being broken rather than as three copies
 * of one state.
 */
export const THEME_EVENT = "cw:theme-choice";

/**
 * Cookie attributes for the theme cookie on this host.
 *
 * Mirrors `sessionCookieOptions`: off the real domain (localhost, a preview
 * deployment) the cookie stays host-only, because `.centerway.net.ua` cannot
 * be set from those hosts at all. `max-age` is a year — there is no session to
 * expire it early, unlike the auth cookie.
 */
export function themeCookieAttributes(host: string, protocol: string): string {
  const onPlatform = isPlatformDomain(host);
  const parts = ["path=/", "max-age=31536000", "samesite=lax"];
  if (protocol === "https:") parts.push("secure");
  if (onPlatform) parts.push(`domain=${SESSION_COOKIE_DOMAIN}`);
  return parts.join(";");
}

function readCookieChoice(): ThemeChoice | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${THEME_STORAGE_KEY}=([^;]*)`));
  if (!match) return null;
  const value = decodeURIComponent(match[1] ?? "");
  return isThemeChoice(value) ? value : null;
}

function writeCookieChoice(next: ThemeChoice): void {
  if (typeof document === "undefined") return;
  try {
    const attrs = themeCookieAttributes(window.location.hostname, window.location.protocol);
    document.cookie = `${THEME_STORAGE_KEY}=${encodeURIComponent(next)};${attrs}`;
  } catch {
    // Cookies can be blocked entirely (some private modes); localStorage,
    // written alongside this, still carries the choice on this one origin.
  }
}

/** Subscribe a `useSyncExternalStore` reader to both writers. */
export function subscribeThemeChoice(onChange: () => void): () => void {
  const relay = (event: Event) => {
    if (event instanceof StorageEvent && event.key !== null && event.key !== THEME_STORAGE_KEY) return;
    onChange();
  };
  window.addEventListener("storage", relay);
  window.addEventListener(THEME_EVENT, relay);
  return () => {
    window.removeEventListener("storage", relay);
    window.removeEventListener(THEME_EVENT, relay);
  };
}

/**
 * Write the choice, paint the document, tell every other copy of the control.
 *
 * Four things now, not three: the cookie is the one every surface under
 * `SESSION_COOKIE_DOMAIN` reads back, `localStorage` is what makes the
 * `storage` event fire for a second tab on this same origin, and the paint
 * and the broadcast are unchanged. A private window can refuse either write
 * and still gets the paint: the choice is then this tab's only, which beats a
 * page that fails to theme itself.
 */
export function setThemeChoice(next: ThemeChoice): void {
  writeCookieChoice(next);
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, next);
  } catch {
    // Storage refused; the document below still changes.
  }
  applyPlatformTheme(resolveTheme(next));
  window.dispatchEvent(new Event(THEME_EVENT));
}

export function isThemeChoice(value: unknown): value is ThemeChoice {
  return typeof value === "string" && (THEME_CHOICES as readonly string[]).includes(value);
}

/**
 * The cookie is read first because it is the one shared across origins; a
 * reader who chose dark on `www` and then followed a link to `my` should not
 * see that choice reported as unset just because this origin's `localStorage`
 * has never heard of it.
 */
export function readThemeChoice(): ThemeChoice {
  if (typeof window === "undefined") return DEFAULT_THEME_CHOICE;
  const cookie = readCookieChoice();
  if (cookie) return cookie;
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
 * The same three writes, as a string, to run BEFORE first paint — plus the
 * cookie read (and, once, the migration into it) that makes the choice follow
 * a reader from `www` to `my` to `build`.
 *
 * It is inlined in the route-group roots rather than imported, because a
 * module would arrive after the first frame and the reader would watch a cream
 * page turn graphite — the flash this exists to prevent. Kept deliberately
 * small and dependency-free for the same reason, and wrapped in try/catch
 * because a private window throws on `localStorage` and can refuse the cookie
 * write too; a page that cannot read a preference must still render.
 *
 * THE COOKIE IS READ FIRST, `localStorage` only as a fallback: on every load
 * after the first one on any surface, the cookie already has the answer and
 * `localStorage` is not consulted at all. The fallback exists for exactly one
 * transition — a reader who chose a theme before this shipped has it in
 * `localStorage` on whichever origin they were last on, and nowhere else. The
 * first load there after deploy finds no cookie, reads that legacy value, and
 * writes it into the cookie so every OTHER surface picks it up from then on —
 * the same one-time carry `adoptLegacySession` does for a session.
 *
 * `document.cookie`, not the helpers above: those call `window.location`,
 * which is fine at click-time but this runs before React and before this
 * module is even guaranteed loaded, so it is its own tiny, literal copy of
 * the same domain rule — same reason `applyPlatformTheme`'s three writes are
 * duplicated here rather than imported.
 *
 * The values are interpolated from the constants above so this cannot drift
 * from `applyPlatformTheme` or `themeCookieAttributes`; nothing here is
 * attacker-controlled.
 */
export const THEME_BOOT_SCRIPT = [
  "(function(){var c,k=" + JSON.stringify(THEME_STORAGE_KEY) + ",h=location.hostname,",
  `d=${JSON.stringify(SESSION_COOKIE_DOMAIN)},`,
  "onP=h===d.slice(1)||h.slice(-d.length)===d;",
  'var mc=document.cookie.match(new RegExp("(?:^|; )"+k+"=([^;]*)"));',
  "if(mc)c=decodeURIComponent(mc[1]);",
  `if(c!=="light"&&c!=="dark"&&c!=="system"){`,
  "try{c=localStorage.getItem(k);}catch(e){}",
  'if(c==="light"||c==="dark"||c==="system"){',
  'try{document.cookie=k+"="+encodeURIComponent(c)+";path=/;max-age=31536000;samesite=lax"+(location.protocol==="https:"?";secure":"")+(onP?";domain="+d:"");}catch(e){}',
  "}}",
  'if(c!=="light"&&c!=="dark"){try{c=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";}catch(e){c="light";}}',
  'var r=document.documentElement;r.setAttribute("data-cw-theme",c);r.style.colorScheme=c;',
  "var m=document.querySelector('meta[name=\"theme-color\"]');",
  `if(m)m.setAttribute("content",c==="dark"?${JSON.stringify(PLATFORM_GROUND_DARK)}:${JSON.stringify(
    PLATFORM_GROUND,
  )});})();`,
].join("");
