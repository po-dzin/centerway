"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { LEARNING_SHELF_HREF, learningNavItem, platformHomeHref, platformNav } from "@/lib/platform/content";
import styles from "@/components/platform/PlatformShellStyles";
import { Icon } from "@/components/Icon";
import { PlatformProfileEntry } from "./PlatformProfileEntry";
import { useHeaderTone } from "./headerTone";
import { PLATFORM_SITE_ORIGIN, useIsBrandedHost } from "./usePlatformHref";
import { usePlatformSession } from "./usePlatformSession";

/**
 * `learn` is not a skin — it is a different job for the same bar.
 *
 * Everywhere else the header's work is to send the reader sideways: programmes,
 * products, tests, the author. Inside a lesson that work is exactly wrong. The
 * player is where someone spends twenty minutes on one thing they already paid
 * for, and every link out of it is a way to not finish. So learning mode drops
 * the showcase nav entirely (and with it the burger — there is nothing to open),
 * and the brand points back at the shelf rather than at the front page: the way
 * out of a lesson is your other courses, not the storefront.
 *
 * What stays is the profile entry, because "which account am I in" is the one
 * question the player itself cannot answer.
 */
export function PlatformHeader({
  initialTone = "light",
  mode = "default",
}: {
  initialTone?: "light" | "dark";
  mode?: "default" | "overlay" | "learn";
}) {
  const learnMode = mode === "learn";
  const [openMenuPath, setOpenMenuPath] = useState<string | null>(null);
  const headerRef = useRef<HTMLElement | null>(null);
  const navLayerRef = useRef<HTMLDivElement | null>(null);
  const toggleRef = useRef<HTMLButtonElement | null>(null);
  const pathname = usePathname();
  const headerTone = useHeaderTone(initialTone, pathname);
  const isBrandedHost = useIsBrandedHost();
  /* Signed in, not "owns a course". Gating on the shelf would mean a fetch in
     the header on every page, and the empty shelf is not a dead end — it says
     what is missing and links to the programmes. Advertising it to a signed-out
     visitor would be the actual mistake, and that is what this excludes. */
  const session = usePlatformSession();
  const brandTarget = learnMode ? LEARNING_SHELF_HREF : platformHomeHref;
  const homeHref = isBrandedHost ? `${PLATFORM_SITE_ORIGIN}${brandTarget}` : brandTarget;
  const navSource = learnMode ? [] : session ? [learningNavItem, ...platformNav] : platformNav;
  const navItems = navSource.map((item) => ({
    ...item,
    resolvedHref: isBrandedHost ? `${PLATFORM_SITE_ORIGIN}${item.href}` : item.href,
  }));
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

  function isActive(href: string, match: "exact" | "prefix") {
    if (!pathname) return false;
    // The learning entry carries a hash (`/profile#learning`) and `pathname`
    // never does, so the raw href would never match and the item could never
    // read as current. Compare paths; the hash selects a section, not a route.
    const path = href.split("#")[0];
    if (match === "exact") return pathname === path;
    return pathname === path || pathname.startsWith(`${path}/`);
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
        {learnMode ? null : (
        <div ref={navLayerRef} className={`${styles.navLayer} ${menuOpen ? styles.navLayerOpen : ""}`} id="platform-mobile-menu">
          <div className={styles.mobileMenuSurface} data-cw-glass="shell">
            <nav className={`${styles.nav} ${styles.mobileMenuNav}`} aria-label="Основна навігація">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.resolvedHref}
                  onClick={closeMenu}
                  aria-current={isActive(item.href, item.match) ? "page" : undefined}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className={styles.mobileProfileSlot}>
              <PlatformProfileEntry mobile onNavigate={closeMenu} />
            </div>
          </div>
        </div>
        )}
        <div className={styles.profileSlot}>
          <PlatformProfileEntry compact />
        </div>
        {learnMode ? null : (
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
        </button>
        )}
      </div>
    </header>
  );
}
