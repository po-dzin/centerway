"use client";

/**
 * ONE SUBSCRIPTION TO WHO IS SIGNED IN.
 *
 * Nine components each held their own `onAuthStateChange` listener and
 * twenty-two places called `getSession()` to find the same answer. Each was
 * cheap; together they were nine renders per auth event and a session that
 * arrived in a different order on every surface. This provider subscribes
 * once, at the root layout, and everything below reads the one value.
 *
 * THREE STATES, NOT TWO. `loading` is the moment before the first
 * `getSession()` resolves, and it is distinct from `signed-out`: a gate that
 * treats the two alike redirects a signed-in person on every cold load, and a
 * header that does blinks its learning entry out and back in. Anything gated
 * on the session should be absent-then-present, never present-then-gone.
 *
 * NO PROVIDER, NO PROBLEM. A component rendered outside the two root layouts
 * — a test, a surface mounted alone — falls back to its own subscription, so
 * the hook's answer is the same everywhere; only the number of listeners differs.
 */

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";

import { supabaseClient } from "@/lib/supabaseClient";

export type SessionStatus = "loading" | "signed-out" | "signed-in";
export type SessionState = { session: Session | null; status: SessionStatus };

export function isAuthConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

/**
 * Whether two sessions are the same answer to "who is signed in, with what".
 *
 * supabase-js hands back a NEW object for `INITIAL_SESSION` and `SIGNED_IN`
 * even when they describe the session `getSession()` just returned. Published
 * as-is, each one is a fresh identity for every consumer downstream.
 */
export function sameSession(a: Session | null, b: Session | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.user?.id === b.user?.id && a.access_token === b.access_token;
}

const SIGNED_OUT: SessionState = { session: null, status: "signed-out" };
const LOADING: SessionState = { session: null, status: "loading" };

function useSubscription(enabled: boolean): SessionState {
  const [state, setState] = useState<SessionState>(() => (enabled && isAuthConfigured() ? LOADING : SIGNED_OUT));

  useEffect(() => {
    if (!enabled || !isAuthConfigured()) return;

    const publish = (next: Session | null) =>
      setState((current) =>
        current.status !== "loading" && sameSession(current.session, next)
          ? current
          : { session: next, status: next ? "signed-in" : "signed-out" },
      );

    void supabaseClient.auth.getSession().then(({ data }) => publish(data.session));
    const {
      data: { subscription },
    } = supabaseClient.auth.onAuthStateChange((_event, next) => publish(next));

    return () => subscription.unsubscribe();
  }, [enabled]);

  return state;
}

const SessionContext = createContext<SessionState | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const state = useSubscription(true);
  return <SessionContext.Provider value={state}>{children}</SessionContext.Provider>;
}

/** The signed-in session and whether it is known yet. */
export function useSession(): SessionState {
  const provided = useContext(SessionContext);
  // Called unconditionally, active only when there is no provider above.
  const own = useSubscription(provided === null);
  return provided ?? own;
}
