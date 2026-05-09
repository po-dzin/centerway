"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { contact, platformNav, socialLinks } from "@/lib/platform/content";
import { supabaseClient } from "@/lib/supabaseClient";
import styles from "./PlatformStyles";

function getUserInitial(session: Session | null) {
  const name = session?.user?.user_metadata?.full_name || session?.user?.user_metadata?.name || session?.user?.email;
  return typeof name === "string" && name.length > 0 ? name.charAt(0).toUpperCase() : "?";
}

function PlatformProfileEntry({
  mobile = false,
  compact = false,
  onNavigate,
}: {
  mobile?: boolean;
  compact?: boolean;
  onNavigate?: () => void;
}) {
  const [session, setSession] = useState<Session | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const isAuthEnabled = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  const syncPlatformUser = useCallback(async (accessToken: string) => {
    await fetch("/api/platform/users/sync", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!isAuthEnabled) return;

    const boot = async () => {
      const { data } = await supabaseClient.auth.getSession();
      setSession(data.session);
      if (data.session?.access_token) void syncPlatformUser(data.session.access_token);
    };
    void boot();

    const {
      data: { subscription },
    } = supabaseClient.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (nextSession?.access_token) void syncPlatformUser(nextSession.access_token);
    });

    return () => subscription.unsubscribe();
  }, [isAuthEnabled, syncPlatformUser]);

  const signInWithGoogle = useCallback(async () => {
    const redirectTo = typeof window !== "undefined" ? window.location.href : undefined;
    await supabaseClient.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
      },
    });
  }, []);

  const signOut = useCallback(async () => {
    await supabaseClient.auth.signOut();
    setMenuOpen(false);
    onNavigate?.();
  }, [onNavigate]);

  const avatarUrl = session?.user?.user_metadata?.avatar_url || session?.user?.user_metadata?.picture || null;
  const label = session?.user ? "Профіль" : "Увійти";

  if (!isAuthEnabled) {
    return (
      <Link
        className={`${styles.profileEntry} ${mobile ? styles.profileEntryMobile : ""} ${compact ? styles.profileEntryCompact : ""}`}
        href="/dosha-test"
        onClick={onNavigate}
        aria-label="Профіль"
      >
        {compact ? <span className={styles.profileGlyph} aria-hidden="true" /> : <span className={styles.profileLabel}>Профіль</span>}
      </Link>
    );
  }

  if (!session?.user) {
    return (
      <button
        className={`${styles.profileEntry} ${mobile ? styles.profileEntryMobile : ""} ${compact ? styles.profileEntryCompact : ""}`}
        type="button"
        aria-label="Увійти"
        onClick={() => {
          onNavigate?.();
          void signInWithGoogle();
        }}
      >
        {compact ? <span className={styles.profileGlyph} aria-hidden="true" /> : <span className={styles.profileLabel}>Увійти</span>}
      </button>
    );
  }

  return (
    <div className={`${styles.profileWrap} ${mobile ? styles.profileWrapMobile : ""}`}>
      <button
        className={`${styles.profileEntry} ${mobile ? styles.profileEntryMobile : ""} ${compact ? styles.profileEntryCompact : ""}`}
        type="button"
        aria-label={label}
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((open) => !open)}
      >
        <span className={styles.profileAvatar} aria-hidden="true">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="" referrerPolicy="no-referrer" />
          ) : (
            getUserInitial(session)
          )}
        </span>
        {compact ? null : <span className={styles.profileLabel}>{label}</span>}
      </button>
      {menuOpen ? (
        <div className={styles.profileMenu}>
          <p>{session.user.email ?? "Google профіль"}</p>
          <Link href="/dosha-test" onClick={onNavigate}>
            Мій тест доши
          </Link>
          <button type="button" onClick={() => void signOut()}>
            Вийти
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function PlatformHeader() {
  const [menuOpen, setMenuOpen] = useState(false);

  function closeMenu() {
    setMenuOpen(false);
  }

  return (
    <header className={styles.header} data-cw-glass="shell" data-menu-open={menuOpen ? "true" : "false"}>
      <div className={`${styles.container} ${styles.headerInner}`}>
        <Link className={styles.brand} href="/" onClick={closeMenu} aria-label="CenterWay">
          <span className={styles.brandSymbol} aria-hidden="true" />
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
        <div className={styles.footerBrandBlock}>
          <Link className={styles.brand} href="/" aria-label="CenterWay" data-surface="footer">
            <span className={styles.brandSymbol} aria-hidden="true" />
            <span className={styles.footerBrandText}>CENTERWAY</span>
          </Link>
          <p className={styles.footerLead}>Аюрведичні програми, консультації та практики відновлення.</p>
        </div>
        <div className={`${styles.footerLinks} ${styles.footerLegal}`}>
          <Link href="/legal/public-offer">Публічний договір</Link>
          <Link href="/legal/privacy">Політика конфіденційності</Link>
        </div>
        <div className={`${styles.footerLinks} ${styles.footerSocials}`}>
          <a href={`tel:${contact.phone.replace(/\s+/g, "")}`}>{contact.phone}</a>
          <div className={styles.footerSocialsRow}>
            {socialLinks.map((item) => (
              <a key={item.label} href={item.href} target="_blank" rel="noopener noreferrer" aria-label={item.label}>
                <span className={styles.footerSocialIcon} data-network={item.network} aria-hidden="true" />
                <span className={styles.srOnly}>{item.label}</span>
              </a>
            ))}
          </div>
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
