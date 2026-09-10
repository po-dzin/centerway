"use client";

import type { ReactNode } from "react";
import styles from "./PlatformShellStyles";
import { PlatformFooter } from "./layout/PlatformFooter";
import { PlatformHeader } from "./layout/PlatformHeader";
import { PlatformAccountMenu } from "./layout/PlatformAccountMenu";
import { PlatformBackOrgan, PlatformMarkOrgan, PlatformOrgans, chromeOrgans } from "./layout/PlatformOrgans";
import { PlatformRouteRows } from "./layout/PlatformRouteRows";
import { PlatformRouteMenu } from "./layout/PlatformRouteMenu";
import { PwaRuntime } from "./pwa/PwaRuntime";
import { SurfaceHostProvider, syntheticHost } from "./layout/SurfaceHost";

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
  back,
  workspaceContent,
}: {
  children: ReactNode;
  headerMode?: "default" | "overlay" | "learn" | "reading";
  footer?: boolean;
  /** Route-local wayfinding for the shared internal workspace bar. */
  workspaceContent?: ReactNode;
  /**
   * The parent of this page, when it has one.
   *
   * «Ліворуч — вихід звідси»: the mark answers that at an application's root
   * and nowhere else. A course inside the library is one level in, so its
   * leading island is an arrow to the shelf — the same control the reader has
   * carried since it lost its bar. Given it, the page also stops printing the
   * breadcrumb in flow on a phone: two affordances for one move, and the text
   * one was the wider of them.
   */
  back?: { href: string; label: string };
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
  const personalSurface = surface === "personal";
  /* The page said which surface it is on; that is what its links resolve
     against. See SurfaceHost.tsx for why this replaced the request's Host. */
  const host = syntheticHost(personalSurface ? "personal" : "public");
  const bare = headerMode === "reading";

  return (
    <SurfaceHostProvider host={host}>
    <div className={`${styles.shell} ${floats ? styles.shellOverlay : ""}`} data-cw-chrome={bare ? "none" : undefined} data-cw-shell-mode={headerMode}
      /* Read by the shell's own stylesheet to re-state the room the hidden bar
         used to hold open below 901px. */
      data-cw-organs={bare ? undefined : "mobile"}>
      {/* THE PHONE'S CHROME, ON EVERY SURFACE THIS SHELL WRAPS (2026-09-06).

          It shipped on `learn` alone a day earlier, and the note here said why
          `overlay` was not the same case: the storefront's bar carries five
          public destinations that are the product's map and not its chrome.
          That was true and it was not a reason to keep two chromes — it was a
          reason to move the map. A phone never showed those five anyway; the
          bar showed a mark and a burger and kept the map one tap inside. The
          islands show a mark and an account and keep it one tap inside THAT,
          which is one sheet on the phone where there were two, both opening
          from the same corner with overlapping lists.

          What is left below 901px is one answer to the two questions every
          surface has: what is this place, and who am I here. See
          docs/design-system.md → "Two chrome modes, and the reader is the
          second one".

          The mark stays a plain link. A surface with sections builds its own
          leading control (the reader does); everything here has none, and a
          sheet holding one row is a menu apologising for existing. */}
      {bare ? null : (
        <PlatformOrgans
          scope="mobile"
          reveal="gesture"
          label="Навігація"
          left={back ? <PlatformBackOrgan href={back.href} label={back.label} /> : <PlatformMarkOrgan />}
          right={
            /* TWO CONTROLS IN THIS CORNER (2026-09-06): the map and the
               account. They were one for a day — the route rows folded into
               the account sheet — and one sheet holding both answered «where
               can I go» and «who am I» in a single column, marking two rows as
               current at once. The burger is the same glyph the bar carries
               above 901px, so the control does not change identity with the
               viewport. */
            <span className={chromeOrgans.pair}>
              {/* `learn` has no top-level route map by design — the lesson tree
                  is the page, not the chrome — so the burger is not rendered
                  there at all rather than opening an empty sheet. */}
              {headerMode === "learn" ? null : (
                <PlatformRouteMenu routes={(close) => <PlatformRouteRows onNavigate={close} />} />
              )}
              <PlatformAccountMenu compact />
            </span>
          }
        />
      )}
      {bare ? null : <PlatformHeader
        /* Desktop-only on every mode now, not just `learn`: below 901px the
           islands above are the chrome, and two of them rendering at once was
           the state this shell was in for exactly one day. */
        scope="desktop"
        initialTone={headerMode === "overlay" ? "dark" : "light"}
        mode={headerMode === "learn" ? "workspace" : headerMode}
        surface={surface}
        workspaceContent={workspaceContent}
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
    </SurfaceHostProvider>
  );
}
