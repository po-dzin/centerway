/**
 * The browser's own chrome, painted the platform's ground.
 *
 * `theme-color` is what a user agent tints its surround with: the address bar
 * on Android Chrome, the status bar on iOS, and — the case this exists for —
 * the title bar of the installed standalone window, which otherwise opens in
 * the OS grey the app never uses anywhere else. Desktop Chrome's tab strip is
 * deliberately NOT covered: it follows the browser theme, and no page can
 * repaint it. That is a browser rule, not a gap here.
 *
 * One value, no `prefers-color-scheme` pair, because the platform ships one
 * theme: the dark palette exists in globals.css under `[data-cw-theme="dark"]`
 * and nothing sets that attribute yet. A dark `theme-color` here would hand a
 * dark-OS user a dark title bar over a page that is still cream. When the dark
 * theme is switched on this becomes a keyed pair — and, because the choice will
 * be a toggle rather than the OS setting, a runtime meta update rather than a
 * media query.
 *
 * Mirrors `--cw-sem-calm-bg`. It is a literal because Next serialises this into
 * <head> on the server, where no custom property has been resolved yet; the one
 * copy lives here so the manifest and the three route-group roots cannot drift.
 */
export const PLATFORM_GROUND = "#faefe0";
