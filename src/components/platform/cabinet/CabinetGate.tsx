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

import Link from "next/link";
import type { ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";

import surfaceStyles from "@/components/platform/PlatformSurfaceStyles";
import { PlatformLoadingState } from "@/components/platform/PlatformLoadingState";
import { getProfileCopy } from "@/components/platform/profile/copy";
import type { ProfileLang } from "@/components/platform/profile/types";
import { isAuthEnabled } from "./useCabinet";

function StatePanel({ label, title, lead, children }: { label: string; title: string; lead: string; children?: ReactNode }) {
  return (
    <main className={surfaceStyles.profileEmptyMain} data-cw-platform-template="profile-empty">
      <section className={`${surfaceStyles.container} ${surfaceStyles.section} ${surfaceStyles.profileEmptySection}`}>
        <article className={`${surfaceStyles.panel} ${surfaceStyles.profileEmptyPanel}`}>
          <p className={surfaceStyles.label}>{label}</p>
          <h1 className={surfaceStyles.title}>{title}</h1>
          <p className={surfaceStyles.lead}>{lead}</p>
          {children}
        </article>
      </section>
    </main>
  );
}

/**
 * Returns the panel to render instead of the page, or null when the page may
 * render its own content.
 */
export function cabinetGate({
  lang,
  loading,
  session,
  error,
  homeHref,
  onSignIn,
  loadingCopy,
  loadingFallback,
}: {
  lang: ProfileLang;
  loading: boolean;
  session: Session | null;
  error?: string | null;
  homeHref: string;
  onSignIn: () => void;
  loadingCopy?: { label?: string; title: string; lead?: string };
  /** Route-owned loading geometry. The gate resolves session state, but the
      route owns the space its final content will occupy. */
  loadingFallback?: ReactNode;
}) {
  const copy = getProfileCopy(lang, { activePrograms: 0, completedPrograms: 0, productPurchases: 0 });

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
    return (
      <StatePanel label={copy.profile} title={copy.authTitle} lead={copy.authLead}>
        <div className={`${surfaceStyles.heroFooter} ${surfaceStyles.profileEmptyActions}`}>
          <button className={surfaceStyles.primaryButton} type="button" onClick={onSignIn}>
            {copy.signIn}
          </button>
          <Link className={surfaceStyles.secondaryButton} href={homeHref}>
            {copy.returnHome}
          </Link>
        </div>
      </StatePanel>
    );
  }

  if (error) {
    return <StatePanel label={copy.profile} title={copy.errorTitle} lead={error} />;
  }

  return null;
}
