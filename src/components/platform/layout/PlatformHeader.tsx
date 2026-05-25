"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { platformHomeHref, platformNav } from "@/lib/platform/content";
import styles from "@/components/platform/PlatformShellStyles";
import { PlatformProfileEntry } from "./PlatformProfileEntry";
import { useHeaderTone } from "./headerTone";
import { PLATFORM_SITE_ORIGIN, useIsBrandedHost } from "./usePlatformHref";

export function PlatformHeader({
  initialTone = "light",
}: {
  initialTone?: "light" | "dark";
}) {
  const [openMenuPath, setOpenMenuPath] = useState<string | null>(null);
  const pathname = usePathname();
  const headerTone = useHeaderTone(initialTone, pathname);
  const isBrandedHost = useIsBrandedHost();
  const homeHref = isBrandedHost ? `${PLATFORM_SITE_ORIGIN}${platformHomeHref}` : platformHomeHref;
  const navItems = platformNav.map((item) => ({
    ...item,
    resolvedHref: isBrandedHost ? `${PLATFORM_SITE_ORIGIN}${item.href}` : item.href,
  }));
  const currentPath = pathname ?? null;
  const menuOpen = openMenuPath !== null && openMenuPath === currentPath;

  useEffect(() => {
    if (typeof document === "undefined") return;
    const { body, documentElement } = document;

    if (menuOpen) {
      body.style.overflow = "hidden";
      body.style.touchAction = "none";
      documentElement.style.overflow = "hidden";
      documentElement.style.touchAction = "none";
    } else {
      body.style.overflow = "";
      body.style.touchAction = "";
      documentElement.style.overflow = "";
      documentElement.style.touchAction = "";
    }

    return () => {
      body.style.overflow = "";
      body.style.touchAction = "";
      documentElement.style.overflow = "";
      documentElement.style.touchAction = "";
    };
  }, [menuOpen, pathname]);

  function closeMenu() {
    setOpenMenuPath(null);
  }

  function isActive(href: string, match: "exact" | "prefix") {
    if (!pathname) return false;
    if (match === "exact") return pathname === href;
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <header
      className={styles.header}
      data-cw-glass="shell"
      data-cw-header-tone={headerTone}
      data-menu-open={menuOpen ? "true" : "false"}
    >
      <div className={`${styles.container} ${styles.headerInner}`}>
        <Link className={styles.brand} href={homeHref} onClick={closeMenu} aria-label="CenterWay">
          <span className={styles.brandSymbol} aria-hidden="true" />
          <span className={styles.brandWordmark} aria-hidden="true" />
        </Link>
        <div className={`${styles.navLayer} ${menuOpen ? styles.navLayerOpen : ""}`} id="platform-mobile-menu">
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
        <div className={styles.profileSlot}>
          <PlatformProfileEntry compact />
        </div>
        <button
          className={styles.menuButton}
          type="button"
          aria-label={menuOpen ? "Закрити меню" : "Відкрити меню"}
          aria-expanded={menuOpen}
          aria-controls="platform-mobile-menu"
          onClick={() => setOpenMenuPath(menuOpen ? null : currentPath)}
        >
          <span />
          <span />
          <span />
        </button>
      </div>
    </header>
  );
}
