"use client";

import { useEffect } from "react";

import "./globals.css";
import { THEME_BOOT_SCRIPT } from "@/lib/platform/theme";
import { PlatformErrorPanel } from "@/components/platform/PlatformError";
import styles from "@/components/platform/PlatformNotFound.module.css";

/**
 * The catch for a render that threw above every route group — the mirror of
 * `global-not-found.tsx` for the other way a page can fail to fetch.
 *
 * A `global-error.tsx` is the ONE boundary Next asks to own the whole
 * document (`<html>` and `<body>` included), because it is what catches a
 * throw from a ROOT LAYOUT itself — `(platform)/error.tsx` cannot, since a
 * segment's own error boundary sits below that segment's layout, not above
 * it. This app has no shared root layout (each route group is its own), so
 * this is the only net under all three.
 *
 * Same three things repeated here as in `global-not-found.tsx`, for the same
 * reason: the token sheet, the theme boot script, the ground on the
 * browser's own chrome. No shell — `PlatformShell` reads the surface host
 * through a provider that lives inside the platform root layout, and this
 * boundary can be reached from outside it (a crash in the layout itself, or
 * from `(funnels)`/`(builder)`, which do not mount that provider the same
 * way). The panel's own two exits are the way out.
 */
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="uk" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
        <main className={styles.standaloneMain} data-cw-platform-template="error">
          <PlatformErrorPanel />
        </main>
      </body>
    </html>
  );
}
