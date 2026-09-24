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

import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";

import { EmailSignIn } from "@/components/auth/EmailSignIn";
import { PlatformLoadingState } from "@/components/platform/PlatformLoadingState";
import surfaceStyles from "@/components/platform/PlatformSurfaceStyles";
import { StatePanel } from "@/components/platform/cabinet/StatePanel";
import { getProfileCopy } from "@/components/platform/profile/copy";
import { isAuthEnabled, useCabinetSession, useProfileLang } from "@/components/platform/cabinet/useCabinet";
import { goToReturnTarget, returnTargetOrCabinet } from "@/lib/auth/signInReturn";

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
 * WHAT MAY BE FOLLOWED is `lib/auth/signInReturn`'s to decide, and it is the
 * same answer here, at the wall in front of `/learn` and `/profile`, and at
 * the header's own door. A sign-in page that takes its destination from the
 * query string is the exact shape of an open redirect, so the rule lives in
 * one place rather than being restated by each screen that carries a `next`.
 * It became one place on 2026-09-20, when the cabinet's move to `my` made the
 * common return a CROSSING — `www` to `my` and back — and this screen's own
 * «a path on this origin» rule would have quietly dropped every one of them.
 */

/* The destination does not change while this screen is mounted: leaving it is
   a navigation, which unmounts it. */
const subscribeToNothing = () => () => {};

/* Asked of the PATH, not of the string: a return address may now be absolute —
   the panel is on `www` and this door is on `my` — and `startsWith("/admin")`
   said no to every one of those, so staff arriving from the panel were handed
   the buyer's «the address you paid with» hint. */
function returnsToAdmin(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return new URL(returnTargetOrCabinet(), window.location.origin).pathname.startsWith("/admin");
  } catch {
    return false;
  }
}

export function EmailSignInScreen() {
  const router = useRouter();
  const lang = useProfileLang();
  const copy = useMemo(() => getProfileCopy(lang, { productPurchases: 0 }), [lang]);
  const { session, loading } = useCabinetSession();

  const leave = useCallback(() => goToReturnTarget(returnTargetOrCabinet(), (path) => router.replace(path)), [router]);

  /* WHO IS AT THIS DOOR (2026-09-13). The hint under the field tells a buyer
     to use the address they paid with — true for the receipt, wrong for staff
     on their way to /admin, who never paid for anything. The destination says
     which one this is. Read as an external store — the address bar is one —
     so the server snapshot (false) and the client's first render agree and no
     effect has to set state after mount. */
  const forStaff = useSyncExternalStore(subscribeToNothing, returnsToAdmin, () => false);

  /* Already signed in — including the moment right after the code is
     accepted, which arrives here as an auth event rather than as a return
     value. One effect covers both, so there is a single way out of this
     screen and no chance of two navigations racing. */
  useEffect(() => {
    if (session?.user) goToReturnTarget(returnTargetOrCabinet(), (path) => router.replace(path));
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
      <EmailSignIn onBack={leave} hint={forStaff ? copy.authEmailStaffHint : undefined} />
    </StatePanel>
  );
}
