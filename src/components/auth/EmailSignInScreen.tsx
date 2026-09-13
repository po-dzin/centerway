"use client";

/**
 * `/signin/email` — the email door, on an address of its own.
 *
 * It exists as a ROUTE and not as a second state of the wall for three
 * reasons, in the order they cost something: a reload in the middle of typing
 * a six-digit code used to drop the person back to the choice of doors; the
 * receipt can now link straight here, which is the one place the instruction
 * "use the address you paid with" is actionable; and the code step gets a
 * screen instead of a panel that grows under a thumb.
 *
 * It lives on the personal host with the surfaces it hands the session to
 * (`SIGNIN_PATH_PREFIX`, src/lib/surfaces/catalog.ts).
 */

import { useCallback, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";

import { EmailSignIn } from "@/components/auth/EmailSignIn";
import { PlatformLoadingState } from "@/components/platform/PlatformLoadingState";
import surfaceStyles from "@/components/platform/PlatformSurfaceStyles";
import { StatePanel } from "@/components/platform/cabinet/StatePanel";
import { getProfileCopy } from "@/components/platform/profile/copy";
import { isAuthEnabled, useCabinetSession, useProfileLang } from "@/components/platform/cabinet/useCabinet";
import { PROFILE_PATH_PREFIX } from "@/lib/surfaces/catalog";

/**
 * Where this door opens onto.
 *
 * READ FROM `window`, NOT FROM `useSearchParams`. That hook forces its whole
 * subtree behind a Suspense boundary and defers it to the client — which for
 * this screen meant the panel never arrived at all, only the loading state it
 * was server-rendered with. Nothing here is rendered FROM the destination; it
 * is only ever navigated TO, so it is read at the moment of leaving and never
 * enters the markup.
 *
 * A sign-in page that takes its destination from the query string is the exact
 * shape of an open redirect: `?next=https://evil.example` would hand a freshly
 * signed-in session to whoever sent the link. Only a plain path on this origin
 * is honoured — a leading slash, and not the protocol-relative `//host` form
 * that a browser reads as another origin.
 */
function nextDestination(): string {
  if (typeof window === "undefined") return PROFILE_PATH_PREFIX;
  const raw = new URLSearchParams(window.location.search).get("next");
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return PROFILE_PATH_PREFIX;
  return raw;
}

export function EmailSignInScreen() {
  const router = useRouter();
  const lang = useProfileLang();
  const copy = useMemo(() => getProfileCopy(lang, { productPurchases: 0 }), [lang]);
  const { session, loading } = useCabinetSession();

  const leave = useCallback(() => router.replace(nextDestination()), [router]);

  /* Already signed in — including the moment right after the code is
     accepted, which arrives here as an auth event rather than as a return
     value. One effect covers both, so there is a single way out of this
     screen and no chance of two navigations racing. */
  useEffect(() => {
    if (session?.user) router.replace(nextDestination());
  }, [router, session]);

  if (!isAuthEnabled) {
    return <StatePanel label={copy.profile} title={copy.unavailableTitle} lead={copy.unavailableLead} />;
  }

  if (loading || session?.user) {
    return (
      <main className={surfaceStyles.profileMain} data-cw-platform-template="loading">
        <div className={surfaceStyles.container}>
          <PlatformLoadingState label={copy.profile} title={copy.loadingTitle} detail={copy.loadingLead} />
        </div>
      </main>
    );
  }

  return (
    <StatePanel label={copy.profile} title={copy.authEmailTitle} lead={copy.authEmailLead} compact>
      <EmailSignIn onBack={leave} />
    </StatePanel>
  );
}
