"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { personalNav, platformHomeHref, platformNav } from "@/lib/platform/content";
import { canonicalPersonalPath } from "@/lib/surfaces/catalog";
import { isPersonalHost } from "@/lib/platform/surfaceHref";
import { currentAppKey, type PlatformAppKey } from "@/lib/platform/apps";
import styles from "@/components/platform/PlatformShellStyles";
import { HandGraphic, Icon } from "@/components/Icon";
import { PlatformAccountIdentity, PlatformAccountMenu } from "./PlatformAccountMenu";
import { useChromeReveal } from "./useChromeReveal";
import { useHeaderTone } from "./headerTone";
import { useSurfaceHost, useSurfaceHref } from "./SurfaceHost";

const MODAL_FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * `learn` is a different application intent: the mark leads back to the shelf
 * and the personal navigation never becomes a public route map.
 */
export function PlatformHeader({
  initialTone = "light",
  mode = "default",
  surface = "auto",
  workspaceContent,
  autoHide = false,
}: {
  initialTone?: "light" | "dark";
  mode?: "default" | "overlay" | "learn" | "workspace";
  surface?: "auto" | "personal";
  /** Route context and document actions inside an internal editor topbar. */
  workspaceContent?: ReactNode;
  /**
   * Let the bar step aside while the page scrolls down, and bring it back on
   * the first scroll up. Every surface that is READ opts in — see
   * `useChromeReveal` for why this is wrong for the builder, whose bar holds
   * controls in use.
   */
  autoHide?: boolean;
}) {
  const focusedMode = mode === "learn" || mode === "workspace";
  const [openMenuPath, setOpenMenuPath] = useState<string | null>(null);
  const headerRef = useRef<HTMLElement | null>(null);
  const navLayerRef = useRef<HTMLDivElement | null>(null);
  const toggleRef = useRef<HTMLButtonElement | null>(null);
  const pathname = usePathname();
  const href = useSurfaceHref();
  const host = useSurfaceHost();
  const onPersonalSurface = surface === "personal" || isPersonalHost(host);
  /* THE HEADER NO LONGER FETCHES. It used to read `user_roles` for one reason:
     the admin entry sat in this nav and could not be derived from the session.
     That entry moved to the account menu, which needs the read anyway and does
     it there — so the rule the bar kept making an exception to is simply true
     again. */
  /* ONE DESTINATION, FROM EVERY SCREEN AND EVERY HOST.

     This used to resolve per surface: the storefront root on `www`, the
     dashboard on `my`. The reasoning was that the one control which never
     changes should not be the one that leaves the app — a fair argument, and
     it is being traded away deliberately for a plainer one. A mark that lands
     somewhere different depending on where it was pressed is not a fixed
     point; it is a control you have to know the context of before you can
     predict it, which is the opposite of what a wordmark is for. The platform
     root is now the answer everywhere.

     `resolveSurfaceHref` already does the hard half: `/` is not a personal
     path, so from `my` — and from the funnel hosts — it comes back as an
     absolute `www` URL, while on `www` and in development it stays relative. */
  const homeHref = href(platformHomeHref);
  /* Which is why the mark cannot always be a `next/link`. Off-origin, the
     router would prefetch a route this origin does not own and still full-load
     on click — the same reason every other crossing in this bar and in the
     account menu is a plain anchor. */
  const homeIsOffOrigin = /^https?:\/\//i.test(homeHref);
  /* Two bars, one component: public routes stay on `www`; `my` keeps only the
     learner shelf and Builder. Lessons intentionally have no top-level route
     map, so the reading surface remains focused. */
  const navSource = focusedMode ? [] : onPersonalSurface ? personalNav : platformNav;
  const navItems = navSource.map((item) => ({
    ...item,
    resolvedHref: href(item.href),
  }));
  /* The account block does not repeat an app that is already in the current
     surface's top-level navigation. */
  const navExcludes = navSource
    .map((item) => currentAppKey(host, item.href))
    .filter((key): key is PlatformAppKey => key !== null);
  const currentPath = pathname ?? null;
  const menuOpen = openMenuPath !== null && openMenuPath === currentPath;
  const headerTone = useHeaderTone(initialTone, pathname, menuOpen);
  /* Locked open while the sheet is: the burger drawer IS this element, so a bar
     that walked off would take the open dialog with it. */
  const { hidden: chromeHidden } = useChromeReveal(autoHide, headerRef, { locked: menuOpen });

  // The mobile menu keeps the geometry of a drawer, but behaves as a modal:
  // background surfaces are inert, scrolling is locked and keyboard focus
  // cannot escape until the user closes it.
  useEffect(() => {
    if (!menuOpen || typeof document === "undefined") return;

    const header = headerRef.current;
    const shell = header?.parentElement;
    const backgroundSiblings = shell
      ? Array.from(shell.children).filter((element) => element !== header)
      : [];
    const previouslyInert = backgroundSiblings.map((element) => element.hasAttribute("inert"));
    backgroundSiblings.forEach((element) => element.setAttribute("inert", ""));

    /* LOCKING THE SCROLL MUST NOT MOVE THE PAGE (2026-08-28).
       `overflow: hidden` on the body takes the classic scrollbar away with it,
       and the page behind the drawer jumps sideways by its width — a flicker on
       every open and close, visible on any platform that reserves a gutter for
       the bar (Windows, Linux, and a macOS set to always-show). The lost width
       is handed back as padding for exactly as long as the lock lasts. */
    const previousOverflow = document.body.style.overflow;
    const previousPadRight = document.body.style.paddingRight;
    const gutter = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    if (gutter > 0) {
      const current = Number.parseFloat(window.getComputedStyle(document.body).paddingRight) || 0;
      document.body.style.paddingRight = `${current + gutter}px`;
    }

    function onPointerDown(event: MouseEvent | TouchEvent) {
      const target = event.target;
      if (target instanceof Node && headerRef.current?.contains(target)) return;
      setOpenMenuPath(null);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpenMenuPath(null);
        toggleRef.current?.focus();
        return;
      }
      if (event.key !== "Tab" || !header) return;

      const focusable = Array.from(header.querySelectorAll<HTMLElement>(MODAL_FOCUSABLE)).filter(
        (element) => element.getClientRects().length > 0
      );
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPadRight;
      backgroundSiblings.forEach((element, index) => {
        if (!previouslyInert[index]) element.removeAttribute("inert");
      });
    };
  }, [menuOpen]);

  /* Bar and drawer are one sheet of glass, and that has to be literally true:
     two adjacent backdrop-filter layers can never meet cleanly, because each
     blurs only its own rectangle and clamps at the edge. Chrome shows a couple
     of units of step at the seam; Safari shows a visible line. So the bar's band
     grows downward to cover the drawer and the drawer paints nothing — one
     filtered rectangle, one set of rounded corners. The height cannot be
     expressed in CSS (the drawer sizes to its content), so it is measured here
     and handed over as a custom property. */
  useEffect(() => {
    const header = headerRef.current;
    const navLayer = navLayerRef.current;
    if (!header) return;

    if (!menuOpen || !navLayer) {
      header.style.removeProperty("--cw-menu-sheet-height");
      return;
    }

    const publish = () => {
      header.style.setProperty("--cw-menu-sheet-height", `${Math.round(navLayer.offsetHeight)}px`);
    };

    publish();

    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(publish);
    observer.observe(navLayer);
    return () => observer.disconnect();
  }, [menuOpen]);

  function closeMenu() {
    setOpenMenuPath(null);
  }

  function isActive(href: string, match: "exact" | "prefix") {
    if (!pathname) return false;
    // Hashes are stripped before comparing: `pathname` never carries one, so a
    // raw href with a fragment could never read as current. Nothing in the nav
    // has one today — the shelf stopped being `/profile#learning` — but a copy
    // link with an anchor is one edit away.
    /* Both sides folded to the address form. On `my` the ROUTE is `/learn` and
       the ADDRESS is `/`, and which of the two `pathname` carries depends on
       whether this render is the server's or the browser's — so comparing raw
       would light the wrong item for exactly as long as hydration takes. */
    const path = canonicalPersonalPath(href.split("#")[0]);
    const here = canonicalPersonalPath((pathname ?? "").split("#")[0]);
    if (match === "exact") return here === path;
    return here === path || here.startsWith(`${path}/`);
  }

  return (
    <header
      ref={headerRef}
      className={styles.header}
      /* One material for every surface: the workspace bar used to opt out of
         the glass and paint a flat panel instead, which made the internal
         topbars — builder, library, admin — a different object from the
         storefront's. */
      data-cw-glass="shell"
      data-cw-header-tone={headerTone}
      data-cw-header-mode={mode}
      /* Two attributes, not one. The first says this bar is allowed to move —
         it carries the transition, so a bar that never yields also never pays
         for one. The second is the state. */
      data-cw-header-autohide={autoHide ? "true" : undefined}
      data-cw-header-hidden={chromeHidden ? "true" : undefined}
      data-menu-open={menuOpen ? "true" : "false"}
      role={menuOpen ? "dialog" : undefined}
      aria-modal={menuOpen ? "true" : undefined}
      aria-label={menuOpen ? "Навігаційне меню" : undefined}
    >
      <button
        className={styles.menuScrim}
        data-cw-scrim="chrome"
        type="button"
        tabIndex={-1}
        aria-label="Закрити навігаційне меню"
        onClick={closeMenu}
      />
      <div className={`${styles.container} ${styles.headerInner}`}>
        {homeIsOffOrigin ? (
          <a className={styles.brand} href={homeHref} onClick={closeMenu} aria-label="CenterWay">
            <span className={styles.brandSymbol} aria-hidden="true" />
            <span className={styles.brandWordmark} aria-hidden="true" />
          </a>
        ) : (
          <Link className={styles.brand} href={homeHref} onClick={closeMenu} aria-label="CenterWay">
            <span className={styles.brandSymbol} aria-hidden="true" />
            <span className={styles.brandWordmark} aria-hidden="true" />
          </Link>
        )}
        {mode === "workspace" && workspaceContent ? (
          <div className={styles.workspaceHeaderSlot}>{workspaceContent}</div>
        ) : null}
        <div
          ref={navLayerRef}
          className={`${styles.navLayer} ${menuOpen ? styles.navLayerOpen : ""}`}
          id="platform-mobile-menu"
        >
          <div className={styles.mobileMenuSurface} data-cw-glass="shell">
            <>
            {/* WHOSE SESSION THIS IS, FIRST. The block lives inside the account
                rows on the desktop popover, which on the phone put it halfway
                down the drawer — below the public destinations, reading as a
                caption on the apps under it. A menu opened on a phone answers
                «whose account» before it answers «where to». The rows below are
                told not to draw it a second time. */}
            <PlatformAccountIdentity />
            <nav className={`${styles.nav} ${styles.mobileMenuNav}`} aria-label="Основна навігація">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.resolvedHref}
                  onClick={closeMenu}
                  aria-current={isActive(item.href, item.match) ? "page" : undefined}
                >
                  <span className={styles.navText}>
                    {item.label}
                    <HandGraphic className={styles.navInkMark} name="ink-stroke" size={36} />
                  </span>
                </Link>
              ))}
            </nav>
            <div className={styles.mobileProfileSlot} data-cw-rule="chrome">
              {/* Whatever the list above already names, the account block does
                  not repeat — and nothing more than that. */}
              <PlatformAccountMenu variant="inline" exclude={navExcludes} onNavigate={closeMenu} showIdentity={false} />
            </div>
            </>
          </div>
        </div>
        <div className={styles.profileSlot}>
          <PlatformAccountMenu compact />
        </div>
        <button
          ref={toggleRef}
          className={styles.menuButton}
          type="button"
          aria-label={menuOpen ? "Закрити меню" : "Відкрити меню"}
          aria-expanded={menuOpen}
          aria-controls="platform-mobile-menu"
          onClick={() => setOpenMenuPath(menuOpen ? null : currentPath)}
        >
          {/* The sprite glyph, not three CSS rules: the burger is part of the
              icon set and has to carry the same baked hand as everything else
              in the bar. Both states render and crossfade, so the control does
              not blink through an empty frame on the swap. */}
          <Icon name="menu" size={32} className={styles.menuGlyph} />
          <Icon name="close" size={32} className={styles.menuGlyphClose} />
          <HandGraphic className={styles.iconInkRing} name="ink-ring" size={42} />
        </button>
      </div>
    </header>
  );
}
