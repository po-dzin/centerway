"use client";

import type { ReactNode } from "react";
import styles from "./PlatformShellStyles";
import { PlatformFooter } from "./layout/PlatformFooter";
import { PlatformHeader } from "./layout/PlatformHeader";
import { PwaRuntime } from "./pwa/PwaRuntime";

/**
 * Three modes, and `learn` is the one that is not cosmetic.
 *
 * `default` and `overlay` differ only in whether the bar floats over a dark
 * hero. `learn` is a different intent for the whole shell: no showcase nav, a
 * brand mark that leads back to the shelf, and a footer stripped to what a
 * reader mid-lesson can use. The player kept the storefront chrome until now —
 * scrolling past the end of a lesson landed you in social links.
 *
 * It keeps the `overlay` clearance, because the learner surfaces were written
 * against it (see the margin note at the top of Lms.module.css).
 */
export function PlatformShell({
  children,
  headerMode = "default",
}: {
  children: ReactNode;
  headerMode?: "default" | "overlay" | "learn";
}) {
  // Both float over the content; only `overlay` floats over a DARK hero, so
  // only it starts the bar on the dark tone. A learner page is a light sheet
  // from the first pixel, and starting dark would flash an inverted bar before
  // the tone sampler corrects it on the first frame.
  const floats = headerMode === "overlay" || headerMode === "learn";

  return (
    <div className={`${styles.shell} ${floats ? styles.shellOverlay : ""}`}>
      <PlatformHeader initialTone={headerMode === "overlay" ? "dark" : "light"} mode={headerMode} />
      {children}
      <PlatformFooter variant={headerMode === "learn" ? "minimal" : "full"} />
      <PwaRuntime />
    </div>
  );
}
