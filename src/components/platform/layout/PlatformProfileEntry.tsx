"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabaseClient } from "@/lib/supabaseClient";
import styles from "@/components/platform/PlatformShellStyles";

function getUserInitial(session: Session | null) {
  const name = session?.user?.user_metadata?.full_name || session?.user?.user_metadata?.name || session?.user?.email;
  return typeof name === "string" && name.length > 0 ? name.charAt(0).toUpperCase() : "?";
}

export function PlatformProfileEntry({
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
