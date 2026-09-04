import type { Metadata, Viewport } from "next";

import "./globals.css";
import { PLATFORM_GROUND } from "@/lib/platform/chrome";
import { THEME_BOOT_SCRIPT } from "@/lib/platform/theme";
import { PlatformNotFoundPanel } from "@/components/platform/PlatformNotFound";
import styles from "@/components/platform/PlatformNotFound.module.css";

/**
 * 404 for an address that matched no route at all.
 *
 * WHY THIS FILE EXISTS SEPARATELY. A `not-found` inside a route group only
 * answers for routes under that group; an unmatched URL belongs to no group,
 * and this app has no root layout to fall back to (each route group is its own
 * root), so until now every typo, every stale shared link and every crawler
 * probe landed on Next's built-in page: black-on-white Helvetica with its own
 * inline stylesheet, no shell, no way out. It was the only surface in the
 * product the theme could not reach, which meant a reader on the dark theme
 * mistyping an address at night took a white screen to the face.
 *
 * IT OWNS THE WHOLE DOCUMENT — that is what `global-not-found` is: <html> and
 * <body> included, because there is no layout above it. So the three things a
 * route-group root does have to be repeated here, and only those three: the
 * token sheet, the theme boot script, and the ground on the browser's own
 * chrome. Nothing else from the platform layout comes along — no analytics, no
 * pixel, no JSON-LD graph. A page that does not exist has nothing to measure
 * and nothing to say to a search engine.
 *
 * NO SHELL, DELIBERATELY. The topbar reads the surface host through a provider
 * that only exists inside the platform root, and a 404 for an unrouted address
 * cannot know which application it was aimed at. The panel's own two links are
 * the way out; see `(platform)/not-found.tsx` for the version that keeps the
 * navigation, which is every 404 raised from a page that does exist.
 */
export const metadata: Metadata = {
  title: "Сторінку не знайдено — CenterWay",
  robots: { index: false, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // The light ground, like every server-rendered head in this app: the server
  // does not know the reader's choice, and the boot script repaints both the
  // document and this meta before the first frame.
  themeColor: PLATFORM_GROUND,
};

export default function GlobalNotFound() {
  return (
    <html lang="uk" suppressHydrationWarning>
      <body suppressHydrationWarning>
        {/* Inline and first, for the same reason as in every route-group root:
            a module would arrive after the first paint and the reader would
            watch a cream page turn graphite. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
        <main className={styles.standaloneMain} data-cw-platform-template="not-found">
          <PlatformNotFoundPanel />
        </main>
      </body>
    </html>
  );
}
