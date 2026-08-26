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
 * hero. `learn` is a personal reading surface: its mark leads back to the
 * shelf and it keeps the personal footer without importing public navigation.
 *
 * IT NOW WEARS THE WORKSPACE BAR — the same flat, full-width top panel the
 * builder uses. Learning and authoring are two views of one document, and an
 * author moving between «Переглянути» and the editor was crossing between a
 * floating storefront plate and an application frame on every trip. The bar
 * that never changes is the one thing that makes them read as one product.
 * Dropping the float also drops the overlay clearance the learner surfaces
 * were written against; they carry their own top margin (see the margin note
 * at the top of Lms.module.css), which is what that note relied on.
 */
export function PlatformShell({
  children,
  headerMode = "default",
  surface = "auto",
  footer = true,
}: {
  children: ReactNode;
  headerMode?: "default" | "overlay" | "learn";
  footer?: boolean;
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
  const floats = headerMode === "overlay";
  const onPersonalHost = isPersonalHost(useSurfaceHost());
  const personalSurface = surface === "personal" || onPersonalHost;

  return (
    <div className={`${styles.shell} ${floats ? styles.shellOverlay : ""}`}>
      <PlatformHeader
        initialTone={headerMode === "overlay" ? "dark" : "light"}
        mode={headerMode === "learn" ? "workspace" : headerMode}
        surface={surface}
      />
      {children}
      {/* The storefront's close — phone, four social networks — is the wrong
          ending for every page of the personal host, not just for a lesson:
          nobody on `my` is being sold to, and every one of those links leaves
          the origin. The personal footer keeps the shape and the brand and
          drops the sales column, and it follows the HOST as well as the mode,
          so `my` ends one way on every page. */}
      {footer ? <PlatformFooter variant={headerMode === "learn" || personalSurface ? "personal" : "full"} /> : null}
      <PwaRuntime />
    </div>
  );
}
