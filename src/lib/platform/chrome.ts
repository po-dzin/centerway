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
 * TWO VALUES SINCE 2026-08-28, and they are swapped at RUNTIME rather than by
 * a `prefers-color-scheme` pair in the metadata. The comment here used to
 * predict exactly that, and the prediction holds for the same reason it was
 * made: the theme follows a stored choice first and the OS setting only as a
 * fallback, so a media-keyed pair would hand a dark-OS reader who chose light
 * a dark title bar over a cream page. `applyPlatformTheme` writes the meta
 * whenever it writes the attribute — one decision, one place.
 *
 * The light value is still what the server serialises into <head>, because the
 * server does not know the reader's choice and light is what a page without
 * JavaScript renders.
 *
 * Mirror `--cw-sem-calm-bg` / the dark scope's `--cw-platform-bg`. They are
 * literals because Next serialises them into <head> on the server, where no
 * custom property has been resolved yet; the one copy lives here so the
 * manifest and the three route-group roots cannot drift.
 */
export const PLATFORM_GROUND = "#faefe0";

export const PLATFORM_GROUND_DARK = "#191918";
