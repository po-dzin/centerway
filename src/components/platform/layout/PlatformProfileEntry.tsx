"use client";

import Link from "next/link";
import type { MouseEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabaseClient } from "@/lib/supabaseClient";
import styles from "@/components/platform/PlatformShellStyles";
import { usePlatformHref } from "./usePlatformHref";
import { isAuthConfigured, usePlatformSession } from "./usePlatformSession";

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
  const session = usePlatformSession();
  const isAuthEnabled = isAuthConfigured();
  const profileHref = usePlatformHref("/profile");

  const signInWithGoogle = async () => {
    const redirectTo = typeof window !== "undefined" ? window.location.href : undefined;
    await supabaseClient.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
      },
    });
  };

  const handleProfileClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (session?.user || !isAuthEnabled) {
      onNavigate?.();
      return;
    }

    event.preventDefault();
    onNavigate?.();
    void signInWithGoogle();
  };

  const avatarUrl = session?.user?.user_metadata?.avatar_url || session?.user?.user_metadata?.picture || null;
  const label = session?.user ? "Профіль" : mobile ? "Профіль" : "Увійти";

  return (
    <Link
      className={`${styles.profileEntry} ${mobile ? styles.profileEntryMobile : ""} ${compact ? styles.profileEntryCompact : ""}`}
      href={profileHref}
      onClick={handleProfileClick}
      aria-label={label}
      data-auth-state={session?.user ? "user" : isAuthEnabled ? "guest" : "fallback"}
    >
      {session?.user ? (
        <span className={styles.profileAvatar} aria-hidden="true">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="" referrerPolicy="no-referrer" />
          ) : (
            getUserInitial(session)
          )}
        </span>
      ) : compact ? (
        <span className={styles.profileGlyph} aria-hidden="true" />
      ) : null}
      {compact ? null : <span className={styles.profileLabel}>{label}</span>}
    </Link>
  );
}
