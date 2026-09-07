"use client";

import Link from "next/link";
import { useRef, type ReactNode } from "react";
import { Icon } from "@/components/Icon";
import { platformHomeHref } from "@/lib/platform/content";
import { useChromeReveal } from "./useChromeReveal";
import { useHeaderTone } from "./headerTone";
import { useSurfaceHref } from "./SurfaceHost";
import styles from "./ChromeOrgans.module.css";

/**
 * Two floating controls instead of a bar.
 *
 * WHAT THIS COMPONENT IS NOT. It is not a header and it does not decide what
 * its islands contain: the pair of questions a surface answers depends on
 * whether that surface is navigated or read, and the two answers are different
 * — see docs/design-system.md → "Two chrome modes, and the reader is the second
 * one". This owns the material, the geometry and the reveal, and nothing else.
 *
 * WHY `reveal` IS A CHOICE AND NOT A DEFAULT. On a page that is READ, the
 * chrome is the way out, and the way out is the one thing nobody reaches for
 * while reading — so it steps aside on the way down and returns on the first
 * flick up (`useChromeReveal`). In an EDITOR that argument inverts: scrolling
 * up is working with the text, not leaving, so controls that vanish on it are
 * hiding from the gesture their user makes most. Builder therefore asks for
 * `always`, exactly as its topbar does today.
 *
 * The reader keeps `ReaderChrome`, which composes the same recipe from
 * `ChromeOrgans.module.css`. It is not folded into this component because its
 * left island is a route and its right island is a cluster of reading tools —
 * the second mode, not a variant of the first.
 */
export function PlatformOrgans({
  left,
  right,
  reveal = "gesture",
  locked = false,
  scope = "all",
  label,
}: {
  /** Leading island: what is in this place. Omit where the surface has none. */
  left?: ReactNode;
  /** Trailing island: who I am and where else I can go. */
  right?: ReactNode;
  /**
   * `gesture` — steps aside on the way down, returns on the first flick up.
   * `always` — stays put, for surfaces whose controls are in use.
   */
  reveal?: "gesture" | "always";
  /**
   * Held in place while a sheet this chrome opened is on screen: the sheet is
   * anchored to an island, and chrome that walked off would take the open
   * dialog's origin with it.
   */
  locked?: boolean;
  /**
   * `mobile` — the islands are the phone's chrome and a bar carries the same
   * surface above 901px. Both are rendered and CSS decides, because a media
   * query read in JS to choose what to MOUNT is answered differently on the
   * server and in the browser, and the difference is a hydration mismatch.
   */
  scope?: "all" | "mobile";
  label?: string;
}) {
  const rowRef = useRef<HTMLDivElement>(null);
  const { hidden } = useChromeReveal(reveal === "gesture", rowRef, { locked });
  /* THE ISLANDS SAMPLE WHAT THEY FLOAT OVER (2026-09-07), exactly as the bar
     has since it was written. This is not a theme question — a translucent
     plate over a graded photograph comes out as a grey smear with near-black
     ink on it whichever gamma is running, and the bar's answer (flip the
     material and the ink to the night side) is the product's baseline for
     chrome that floats. Below 901px the islands ARE the chrome, and they were
     the only floating surface still standing on the page's own palette.

     Frozen while a sheet this row opened is on screen: the sheet is above the
     islands and portalled over the page, so sampling would read the panel
     rather than the article, and the row drops its plate there anyway. */
  const tone = useHeaderTone("light", undefined, locked);

  return (
    <div
      className={styles.row}
      ref={rowRef}
      data-cw-chrome="organs"
      data-cw-header-tone={tone}
      data-cw-organs-scope={scope === "mobile" ? "mobile" : undefined}
      data-hidden={hidden ? "true" : undefined}
      role="group"
      aria-label={label}
    >
      {/* Both corners are always occupied, by a control or by nothing that can
          be seen: `space-between` with a single child puts that child at the
          leading edge, which would silently move a lone account control to the
          side the reader reads a section list on. */}
      {left ?? <span className={styles.absent} aria-hidden="true" />}
      {right ?? <span className={styles.absent} aria-hidden="true" />}
    </div>
  );
}

/**
 * The island recipes, for surfaces that build their own controls.
 *
 * Handed out as class names rather than as components because the element
 * differs every time — a link, a button, a menu trigger, a cluster of three —
 * and a wrapper that took `as` would only be spelling `className` twice.
 */
/**
 * The mark as the leading island: a way back to the platform and nothing else.
 *
 * This is what the left control is on every surface that has no inner structure
 * to offer — the shelf, the cabinet, a landing. A sheet holding one row is a
 * menu apologising for existing; where there ARE sections, the surface builds
 * its own trigger instead of using this.
 *
 * Off-origin it must not be a `next/link`: `my` does not own the platform root,
 * so the router would prefetch a route this origin cannot serve and still
 * full-load on click — the same reason every other crossing in the bar and in
 * the account menu is a plain anchor.
 */
export function PlatformMarkOrgan({ onNavigate }: { onNavigate?: () => void }) {
  const href = useSurfaceHref()(platformHomeHref);
  const offOrigin = /^https?:\/\//i.test(href);
  const inner = <span className={styles.mark} aria-hidden="true" />;

  return offOrigin ? (
    <a className={styles.organ} href={href} onClick={onNavigate} aria-label="CenterWay">
      {inner}
    </a>
  ) : (
    <Link className={styles.organ} href={href} onClick={onNavigate} aria-label="CenterWay">
      {inner}
    </Link>
  );
}

/**
 * THE WAY OUT OF ONE LEVEL, as the leading island.
 *
 * «Ліворуч — вихід звідси» is the whole rule, and the mark is only its answer
 * at an application's ROOT. One level in — a course inside the library, a
 * lesson inside the workshop — the honest answer is the parent, and the mark
 * there is a control that leaves the app from inside a document. The reader has
 * worked this way since 2026-08-29 (`ReaderChrome`); this is that arrow, in the
 * shared island, so the course map and the editor speak it too.
 *
 * NO TITLE ON IT, and the reader's note says why: any course name longer than
 * half a phone's width came back as a fragment with an ellipsis, and that
 * fragment was then the widest object on the screen. The destination is the
 * `aria-label`; the page it returns to writes its own name in full.
 *
 * A CALLBACK OR AN HREF. The workshop must be able to ASK before it leaves — an
 * unsaved paragraph is not something a route change gets to discard quietly —
 * so the editor passes `onNavigate` and everything else passes `href`.
 */
export function PlatformBackOrgan({
  href,
  onNavigate,
  label,
}: {
  href?: string;
  onNavigate?: () => void;
  label: string;
}) {
  const glyph = <Icon name="arrow-left" size={18} />;

  if (onNavigate) {
    return (
      <button className={styles.organ} type="button" onClick={onNavigate} aria-label={label} title={label}>
        {glyph}
      </button>
    );
  }

  return (
    <Link className={styles.organ} href={href ?? "/"} aria-label={label} title={label}>
      {glyph}
    </Link>
  );
}

export const chromeOrgans = {
  /** One control on the chrome material. */
  organ: styles.organ,
  /** Several controls travelling as one object. */
  cluster: styles.cluster,
  /** Two islands sharing a corner without sharing a plate. */
  pair: styles.pair,
} as const;
