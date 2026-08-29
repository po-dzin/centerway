"use client";

import type { ReactNode } from "react";
import styles from "./PlatformShellStyles";
import { PlatformFooter } from "./layout/PlatformFooter";
import { PlatformHeader } from "./layout/PlatformHeader";
import { PwaRuntime } from "./pwa/PwaRuntime";
import { useSurfaceHost } from "./layout/SurfaceHost";
import { isPersonalHost } from "@/lib/platform/surfaceHref";

/**
 * Four modes, and two of them are not cosmetic.
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
 *
 * `reading` MOUNTS NO BAR AT ALL (2026-08-29), and it is the one surface that
 * should not have one. A bar earns a full-width band by answering «where am I»
 * for a page with somewhere to go; a lesson is one column of prose with two
 * answers — out, and the four reading tools — and it was paying a 64px band
 * plus a crumb row plus a tool row before the title, three rows of chrome over
 * one column. Those two answers are floating controls now (see `.readerChrome`
 * in Lms.module.css), so while the eye is in the text there is nothing over it.
 * The COURSE page keeps the bar: a course map is wayfinding and has a shelf, a
 * builder and an account to reach.
 */
export function PlatformShell({
  children,
  headerMode = "default",
  surface = "auto",
  footer = true,
}: {
  children: ReactNode;
  headerMode?: "default" | "overlay" | "learn" | "reading";
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
  const bare = headerMode === "reading";

  return (
    <div className={`${styles.shell} ${floats ? styles.shellOverlay : ""}`} data-cw-chrome={bare ? "none" : undefined}>
      {bare ? null : <PlatformHeader
        initialTone={headerMode === "overlay" ? "dark" : "light"}
        mode={headerMode === "learn" ? "workspace" : headerMode}
        surface={surface}
        /* EVERY SURFACE THIS SHELL WRAPS, because every one of them is read
           rather than operated. It started on the lesson and it is the same
           argument on the storefront, the catalogue and the dashboard: while
           you are moving down a page the bar is only the way OUT, and the way
           out is the one thing you are not reaching for. Scrolling up is
           already the gesture that means «I am done here», so the chrome comes
           back where the hand is, in one flick, from anywhere in the document.

           The exception is not expressible here and does not need to be: the
           builder does not go through this shell. It mounts PlatformHeader
           itself (BuilderShell.tsx) and leaves this off, because its bar holds
           save state, undo and the preview button — controls in use, which a
           bar that walks off mid-edit would be hiding. */
        autoHide
      />}
      {children}
      {/* The storefront's close — phone, four social networks — is the wrong
          ending for every page of the personal host, not just for a lesson:
          nobody on `my` is being sold to, and every one of those links leaves
          the origin. The personal footer keeps the shape and the brand and
          drops the sales column, and it follows the HOST as well as the mode,
          so `my` ends one way on every page. */}
      {footer ? <PlatformFooter variant={headerMode === "learn" || bare || personalSurface ? "personal" : "full"} /> : null}
      <PwaRuntime />
    </div>
  );
}
