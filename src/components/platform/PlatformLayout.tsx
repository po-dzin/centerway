"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { contact, platformNav, socialLinks } from "@/lib/platform/content";
import { supabaseClient } from "@/lib/supabaseClient";
import styles from "./PlatformStyles";

type HeaderTone = "light" | "dark";

function getUserInitial(session: Session | null) {
  const name = session?.user?.user_metadata?.full_name || session?.user?.user_metadata?.name || session?.user?.email;
  return typeof name === "string" && name.length > 0 ? name.charAt(0).toUpperCase() : "?";
}

function parseCssColor(value: string) {
  const normalized = value.trim().toLowerCase();

  if (normalized.startsWith("rgb")) {
    const parts = normalized.match(/[\d.]+/g);
    if (!parts || parts.length < 3) return null;
    return {
      r: Number(parts[0]),
      g: Number(parts[1]),
      b: Number(parts[2]),
      a: parts[3] ? Number(parts[3]) : 1,
    };
  }

  if (normalized.startsWith("#")) {
    const hex = normalized.slice(1);
    if (hex.length === 3 || hex.length === 4) {
      return {
        r: parseInt(hex[0] + hex[0], 16),
        g: parseInt(hex[1] + hex[1], 16),
        b: parseInt(hex[2] + hex[2], 16),
        a: hex.length === 4 ? parseInt(hex[3] + hex[3], 16) / 255 : 1,
      };
    }

    if (hex.length === 6 || hex.length === 8) {
      return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16),
        a: hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1,
      };
    }
  }

  return null;
}

function luminanceFromColor(color: { r: number; g: number; b: number }) {
  const channels = [color.r, color.g, color.b].map((value) => {
    const channel = value / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });

  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function resolveToneFromPoint(x: number, y: number): HeaderTone | null {
  const elements = document.elementsFromPoint(x, y);

  for (const node of elements) {
    if (!(node instanceof HTMLElement)) continue;
    if (node.closest("header[data-cw-header-tone]")) continue;

    const explicitTone = node.closest<HTMLElement>("[data-cw-topbar-tone]")?.dataset.cwTopbarTone;
    if (explicitTone === "light" || explicitTone === "dark") return explicitTone;

    let current: HTMLElement | null = node;

    while (current && current !== document.body) {
      const style = window.getComputedStyle(current);
      const backgroundImage = style.backgroundImage;
      const parsed = parseCssColor(style.backgroundColor);

      if (parsed && parsed.a > 0.08) {
        return luminanceFromColor(parsed) < 0.34 ? "dark" : "light";
      }

      if (backgroundImage && backgroundImage !== "none") {
        return "dark";
      }

      current = current.parentElement;
    }
  }

  return null;
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
        data-auth-state="fallback"
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
        data-auth-state="guest"
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
        data-auth-state="user"
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
  const [headerTone, setHeaderTone] = useState<HeaderTone>("light");

  useEffect(() => {
    if (typeof document === "undefined") return;
    const { body } = document;
    const previousOverflow = body.style.overflow;
    const previousTouchAction = body.style.touchAction;

    if (menuOpen) {
      body.style.overflow = "hidden";
      body.style.touchAction = "none";
    }

    return () => {
      body.style.overflow = previousOverflow;
      body.style.touchAction = previousTouchAction;
    };
  }, [menuOpen]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    let frame = 0;

    const updateTone = () => {
      frame = 0;
      const header = document.querySelector<HTMLElement>("header[data-cw-header-tone]");
      const headerHeight = header?.offsetHeight ?? 72;
      const sampleY = Math.max(16, Math.min(window.innerHeight - 16, Math.round(headerHeight * 0.72)));
      const samplePoints = [0.18, 0.5, 0.82].map((ratio) => Math.round(window.innerWidth * ratio));
      const tones = samplePoints
        .map((sampleX) => resolveToneFromPoint(sampleX, sampleY))
        .filter((tone): tone is HeaderTone => tone === "light" || tone === "dark");

      if (!tones.length) return;

      const darkVotes = tones.filter((tone) => tone === "dark").length;
      setHeaderTone(darkVotes >= Math.ceil(tones.length / 2) ? "dark" : "light");
    };

    const requestToneUpdate = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(updateTone);
    };

    updateTone();
    window.addEventListener("scroll", requestToneUpdate, { passive: true });
    window.addEventListener("resize", requestToneUpdate);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", requestToneUpdate);
      window.removeEventListener("resize", requestToneUpdate);
    };
  }, []);

  function closeMenu() {
    setMenuOpen(false);
  }

  return (
    <header
      className={styles.header}
      data-cw-glass="shell"
      data-cw-header-tone={headerTone}
      data-menu-open={menuOpen ? "true" : "false"}
    >
      <div className={`${styles.container} ${styles.headerInner}`}>
        <Link className={styles.brand} href="/" onClick={closeMenu} aria-label="CenterWay">
          <span className={styles.brandSymbol} aria-hidden="true" />
          <span className={styles.brandWordmark} aria-hidden="true" />
        </Link>
        <div className={`${styles.navLayer} ${menuOpen ? styles.navLayerOpen : ""}`} id="platform-mobile-menu">
          <div className={styles.mobileMenuSurface} data-cw-glass="shell">
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
