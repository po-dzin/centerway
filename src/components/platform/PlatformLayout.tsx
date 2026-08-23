"use client";

import type { ReactNode } from "react";
import styles from "./PlatformShellStyles";
import { PlatformFooter } from "./layout/PlatformFooter";
import { PlatformHeader } from "./layout/PlatformHeader";
import { PwaRuntime } from "./pwa/PwaRuntime";
import { useSurfaceHost } from "./layout/SurfaceHost";
import { isPersonalHost } from "@/lib/platform/surfaceHref";

/**
 * Three modes, and `learn` is the one that is not cosmetic.
 *
 * `default` and `overlay` differ only in whether the bar floats over a dark
 * hero. `learn` keeps a brand mark that leads back to the shelf and a footer
 * stripped to what a reader mid-lesson can use. Its header still exposes the
 * shared route map so course pages do not become a navigation dead end.
 *
 * It keeps the `overlay` clearance, because the learner surfaces were written
 * against it (see the margin note at the top of Lms.module.css).
 */
export function PlatformShell({
  children,
  headerMode = "default",
  surface = "auto",
}: {
  children: ReactNode;
  headerMode?: "default" | "overlay" | "learn";
  /**
   * Route-owned application identity. Host detection remains the default for
   * public pages, but personal routes must also render correctly on localhost
   * and preview where both applications share one origin.
   */
  surface?: "auto" | "personal";
}) {
  // Both float over the content; only `overlay` floats over a DARK hero, so
  // only it starts the bar on the dark tone. A learner page is a light sheet
  // from the first pixel, and starting dark would flash an inverted bar before
  // the tone sampler corrects it on the first frame.
  const floats = headerMode === "overlay" || headerMode === "learn";
  const onPersonalHost = isPersonalHost(useSurfaceHost());
  const personalSurface = surface === "personal" || onPersonalHost;

  return (
    <div className={`${styles.shell} ${floats ? styles.shellOverlay : ""}`}>
      <PlatformHeader
        initialTone={headerMode === "overlay" ? "dark" : "light"}
        mode={headerMode}
        surface={surface}
      />
      {children}
      {/* The storefront's close — phone, four social networks — is the wrong
          ending for every page of the personal host, not just for a lesson:
          nobody on `my` is being sold to, and every one of those links leaves
          the origin. The personal footer keeps the shape and the brand and
          drops the sales column, and it follows the HOST as well as the mode,
          so `my` ends one way on every page. */}
      <PlatformFooter variant={headerMode === "learn" || personalSurface ? "personal" : "full"} />
      <PwaRuntime />
    </div>
  );
}
