"use client";

/**
 * The four states that come before either page of "mine" can render: auth
 * disabled, still loading, signed out, read failed.
 *
 * One component, because `/learn` and `/profile` must be indistinguishable
 * here. A learner who follows a lesson link while signed out lands on the shelf
 * and must meet exactly the sign-in wall they would have met on the profile —
 * same words, same button, same surface. Two copies of that would drift within
 * a release.
 */

import type { ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";

import surfaceStyles from "@/components/platform/PlatformSurfaceStyles";
import { SignInOptions } from "@/components/auth/SignInOptions";
import type { GoogleSignInIntent } from "@/lib/auth/lastAccount";
import { PlatformLoadingState } from "@/components/platform/PlatformLoadingState";
import { StatePanel } from "./StatePanel";
import { getProfileCopy } from "@/components/platform/profile/copy";
import type { ProfileLang } from "@/components/platform/profile/types";
import { isAuthEnabled } from "./useCabinet";

/**
 * Returns the panel to render instead of the page, or null when the page may
 * render its own content.
 */
export function cabinetGate({
  lang,
  loading,
  session,
  error,
  onSignIn,
  loadingCopy,
  loadingFallback,
}: {
  lang: ProfileLang;
  loading: boolean;
  session: Session | null;
  error?: string | null;
  onSignIn: (intent?: GoogleSignInIntent) => void;
  loadingCopy?: { label?: string; title: string; lead?: string };
  /** Route-owned loading geometry. The gate resolves session state, but the
      route owns the space its final content will occupy. */
  loadingFallback?: ReactNode;
}) {
  const copy = getProfileCopy(lang, { productPurchases: 0 });

  if (!isAuthEnabled) {
    return <StatePanel label={copy.profile} title={copy.unavailableTitle} lead={copy.unavailableLead} />;
  }

  if (loading) {
    if (loadingFallback) return loadingFallback;
    return (
      <main className={surfaceStyles.profileMain} data-cw-platform-template="loading">
        <div className={surfaceStyles.container}>
          <PlatformLoadingState
            label={loadingCopy?.label ?? copy.profile}
            title={loadingCopy?.title ?? copy.loadingTitle}
            detail={loadingCopy?.lead ?? copy.loadingLead}
          />
        </div>
      </main>
    );
  }

  if (!session?.user) {
    /* THE DOOR A BUYER ARRIVES AT. The receipt sends them here and tells them
       to use the address they paid with, because that address is what links the
       purchase to an account. Offering only Google made that instruction
       impossible to follow for anyone whose mail is not Google — so email is
       the second way in, one step behind at `/signin/email`.

       No way back below the door: the mark in the header and the menu already
       lead home, and a third copy of the same link reads as the panel's own
       conclusion rather than as navigation. */
    return (
      <StatePanel label={copy.profile} title={copy.authTitle} lead={copy.authLead} compact>
        <SignInOptions googleLabel={copy.signIn} onGoogle={onSignIn} />
      </StatePanel>
    );
  }

  if (error) {
    return <StatePanel label={copy.profile} title={copy.errorTitle} lead={error} />;
  }

  return null;
}
