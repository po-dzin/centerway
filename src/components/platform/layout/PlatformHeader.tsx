"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { LEARNING_SHELF_HREF, platformHomeHref, platformNav } from "@/lib/platform/content";
import { canonicalPersonalPath } from "@/lib/surfaces/catalog";
import { isPersonalHost } from "@/lib/platform/surfaceHref";
import { currentAppKey, type PlatformAppKey } from "@/lib/platform/apps";
import styles from "@/components/platform/PlatformShellStyles";
import { HandGraphic, Icon } from "@/components/Icon";
import { PlatformAccountMenu } from "./PlatformAccountMenu";
import { useHeaderTone } from "./headerTone";
import { useSurfaceHost, useSurfaceHref } from "./SurfaceHost";

/**
 * `learn` keeps the learner-oriented brand target, but it does not remove the
 * platform route map. Course pages still need the same predictable way back to
 * diagnostics, programmes, products and consultation as the rest of the
 * platform; on mobile those routes live in the burger drawer.
 */
export function PlatformHeader({
  initialTone = "light",
  mode = "default",
  surface = "auto",
}: {
  initialTone?: "light" | "dark";
  mode?: "default" | "overlay" | "learn";
  surface?: "auto" | "personal";
}) {
  const learnMode = mode === "learn";
  const [openMenuPath, setOpenMenuPath] = useState<string | null>(null);
  const headerRef = useRef<HTMLElement | null>(null);
  const navLayerRef = useRef<HTMLDivElement | null>(null);
  const toggleRef = useRef<HTMLButtonElement | null>(null);
  const pathname = usePathname();
  const headerTone = useHeaderTone(initialTone, pathname);
  const href = useSurfaceHref();
  const host = useSurfaceHost();
  const onPersonalSurface = surface === "personal" || isPersonalHost(host);
  /* THE HEADER NO LONGER FETCHES. It used to read `user_roles` for one reason:
     the admin entry sat in this nav and could not be derived from the session.
     That entry moved to the account menu, which needs the read anyway and does
     it there — so the rule the bar kept making an exception to is simply true
     again. */
  /* The brand mark is a link to the root of THIS application, on every screen
     of it. On `my` that is the dashboard — pointing it at the storefront would
     make the one control that never changes the one that leaves. */
  const brandTarget = learnMode || onPersonalSurface ? LEARNING_SHELF_HREF : platformHomeHref;
  const homeHref = href(brandTarget);
  /* ONE PUBLIC ROUTE MAP ON BOTH ORIGINS. `my` is a personal application, but
     the owner explicitly keeps the public platform routes visible in its bar;
     Profile, Learning, Builder and Admin remain application destinations in
     the account menu. Every crossing is resolved to an absolute `www` URL. */
  const navSource = platformNav;
  const navItems = navSource.map((item) => ({
    ...item,
    resolvedHref: href(item.href),
  }));
  /* Applications already named by the route map are excluded from the account
     block below the mobile list. Public routes map to no application key, so
     the personal destinations remain available there. */
  const navExcludes = navSource
    .map((item) => currentAppKey(host, item.href))
    .filter((key): key is PlatformAppKey => key !== null);
  const currentPath = pathname ?? null;
  const menuOpen = openMenuPath !== null && openMenuPath === currentPath;

  // The mobile menu is a drawer hung off the bar, not a full-screen sheet, so
  // the page behind it stays live: no scroll lock, and the two ways out of a
  // drawer — click away, press Escape — have to exist. Same contract as the
  // network bar (shared/js/network-nav.js).
  useEffect(() => {
    if (!menuOpen || typeof document === "undefined") return;

    function onPointerDown(event: MouseEvent | TouchEvent) {
      const target = event.target;
      if (target instanceof Node && headerRef.current?.contains(target)) return;
      setOpenMenuPath(null);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpenMenuPath(null);
      toggleRef.current?.focus();
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
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

  function isActive(href: string, match: "exact" | "prefix", resolvedHref = href) {
    if (!pathname) return false;
    // Every public route is off-origin while this bar is rendered on `my`.
    // Comparing only raw pathnames would mark `/` as both «Головна» and «Мої
    // курси», even though the Home link correctly points to `www`.
    if (/^https?:\/\//i.test(resolvedHref)) return false;
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
      data-cw-glass="shell"
      data-cw-header-tone={headerTone}
      data-cw-header-mode={mode}
      data-menu-open={menuOpen ? "true" : "false"}
    >
      <div className={`${styles.container} ${styles.headerInner}`}>
        <Link className={styles.brand} href={homeHref} onClick={closeMenu} aria-label="CenterWay">
          <span className={styles.brandSymbol} aria-hidden="true" />
          <span className={styles.brandWordmark} aria-hidden="true" />
        </Link>
        <div ref={navLayerRef} className={`${styles.navLayer} ${menuOpen ? styles.navLayerOpen : ""}`} id="platform-mobile-menu">
          <div className={styles.mobileMenuSurface} data-cw-glass="shell">
            <nav className={`${styles.nav} ${styles.mobileMenuNav}`} aria-label="Основна навігація">
              <Link
                className={styles.mobileHomeNavItem}
                href={href(platformHomeHref)}
                onClick={closeMenu}
                aria-current={isActive(platformHomeHref, "exact", href(platformHomeHref)) ? "page" : undefined}
              >
                <span className={styles.navText}>
                  Головна
                  <HandGraphic className={styles.navInkMark} name="ink-stroke" size={36} />
                </span>
              </Link>
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.resolvedHref}
                  onClick={closeMenu}
                  aria-current={isActive(item.href, item.match, item.resolvedHref) ? "page" : undefined}
                >
                  <span className={styles.navText}>
                    {item.label}
                    <HandGraphic className={styles.navInkMark} name="ink-stroke" size={36} />
                  </span>
                </Link>
              ))}
            </nav>
            <div className={styles.mobileProfileSlot}>
              {/* Whatever the list above already names, the account block does
                  not repeat — and nothing more than that. */}
              <PlatformAccountMenu variant="inline" exclude={navExcludes} onNavigate={closeMenu} />
            </div>
          </div>
        </div>
        <div className={styles.profileSlot}>
          <PlatformAccountMenu compact includePlatformNavigation={onPersonalSurface || learnMode} />
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
