"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useState } from "react";
import { contact, platformNav, socialLinks } from "@/lib/platform/content";
import styles from "./PlatformStyles";

export function PlatformHeader() {
  const [menuOpen, setMenuOpen] = useState(false);

  function closeMenu() {
    setMenuOpen(false);
  }

  return (
    <header className={styles.header} data-cw-glass="shell" data-menu-open={menuOpen ? "true" : "false"}>
      <div className={`${styles.container} ${styles.headerInner}`}>
        <Link className={styles.brand} href="/" onClick={closeMenu}>
          <span className={styles.mark}>CW</span>
          <span>CenterWay</span>
        </Link>
        <div className={`${styles.navLayer} ${menuOpen ? styles.navLayerOpen : ""}`} id="platform-mobile-menu">
          <div className={styles.mobileMenuSurface}>
            <nav className={`${styles.nav} ${styles.mobileMenuNav}`} aria-label="Основна навігація">
              {platformNav.map((item) => (
                <Link key={item.href} href={item.href} onClick={closeMenu}>
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>
        <button
          className={styles.menuButton}
          type="button"
          aria-label={menuOpen ? "Закрити меню" : "Відкрити меню"}
          aria-expanded={menuOpen}
          aria-controls="platform-mobile-menu"
          data-cw-glass="control"
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span />
          <span />
          <span />
        </button>
      </div>
    </header>
  );
}

export function PlatformFooter() {
  return (
    <footer className={styles.footer}>
      <div className={`${styles.container} ${styles.footerGrid}`}>
        <div>
          <Link className={styles.brand} href="/">
            <span className={styles.mark}>CW</span>
            <span>CenterWay</span>
          </Link>
          <p className={styles.lead}>Аюрведичні програми, консультації та практики відновлення.</p>
        </div>
        <div className={styles.footerLinks}>
          <Link href="/legal/public-offer">Публічний договір</Link>
          <Link href="/legal/privacy">Політика конфіденційності</Link>
          <a href={`tel:${contact.phone.replace(/\s+/g, "")}`}>{contact.phone}</a>
        </div>
        <div className={styles.footerLinks}>
          {socialLinks.map((item) => (
            <a key={item.label} href={item.href} target="_blank" rel="noopener noreferrer">
              {item.label}
            </a>
          ))}
        </div>
      </div>
    </footer>
  );
}

export function PlatformShell({
  children,
  headerMode = "default",
}: {
  children: ReactNode;
  headerMode?: "default" | "overlay";
}) {
  return (
    <div className={`${styles.shell} ${headerMode === "overlay" ? styles.shellOverlay : ""}`}>
      <PlatformHeader />
      {children}
      <PlatformFooter />
    </div>
  );
}
