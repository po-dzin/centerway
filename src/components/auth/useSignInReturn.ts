"use client";

/**
 * THE LAST STEP OF A SIGN-IN THAT BEGAN SOMEWHERE ELSE.
 *
 * The header's door is a link to the cabinet, so the round trip ends there —
 * on the dashboard, with whatever the reader was actually doing left behind.
 * The crossing carries `?next=` (see `lib/auth/signInReturn`), and this is
 * what spends it: the moment a session exists on a surface holding a return
 * address, the reader is put back where they were.
 *
 * IT WATCHES THE SESSION, not the click. The session can arrive three ways —
 * an OAuth redirect back into this page, a code typed into the door, or a
 * second tab signing in — and all three surface as the same auth event. One
 * effect answers all of them, which is also why sign-in needs no callback of
 * its own.
 *
 * THE DESTINATION IS NEVER THE PAGE ASKING. `?next=` pointing at the address
 * already on screen would be a replace to nowhere on every render of the
 * cabinet, so it is dropped rather than followed.
 */

import { useEffect, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import type { Session } from "@supabase/supabase-js";

import { goToReturnTarget, readReturnTarget, returnQuery, returnTargetFromHere } from "@/lib/auth/signInReturn";

export function useSignInReturn(session: Session | null): void {
  const router = useRouter();
  const signedIn = Boolean(session?.user);

  useEffect(() => {
    if (!signedIn || typeof window === "undefined") return;
    const target = readReturnTarget();
    if (!target) return;

    const resolved = new URL(target, window.location.origin);
    if (resolved.origin === window.location.origin && resolved.pathname === window.location.pathname) return;

    goToReturnTarget(target, (path) => router.replace(path));
  }, [signedIn, router]);
}

/**
 * A link to the door that carries where the reader is standing now.
 *
 * READ AS AN EXTERNAL STORE, not in render. The address bar is one, and it does
 * not exist on the server: computing the `next` during render would put one
 * href in the markup and a different one in the first client render, which is
 * a hydration mismatch on a link the header ships on every page. The server
 * snapshot is «nothing to carry», so the markup is the plain door and the
 * return address is added the moment the browser has one.
 */
export function useSignInHref(base: string): string {
  const target = useSyncExternalStore(
    subscribeToNothing,
    () => returnTargetFromHere() ?? "",
    () => "",
  );
  /* Spelled RELATIVE when the door is on this origin — which it is on
     localhost and on a preview, where one host serves both families. The
     address bar stays readable and the value means the same thing either way;
     `safeReturnTarget` accepts both. */
  const sameOrigin = !/^https?:\/\//i.test(base) && typeof window !== "undefined";
  const value =
    sameOrigin && target.startsWith(window.location.origin) ? target.slice(window.location.origin.length) : target;
  return `${base}${returnQuery(value || null)}`;
}

/* The address does not change under this component: a navigation re-renders it
   and re-reads the snapshot, and nothing else can move it. */
function subscribeToNothing() {
  return () => {};
}
