"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";

import { supabaseClient } from "@/lib/supabaseClient";

export function isAuthConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

/**
 * The signed-in session, or null.
 *
 * Extracted from PlatformProfileEntry when the header gained a second reason to
 * care who is signed in (the learning entry). Both consumers subscribe rather
 * than sharing one store: two `onAuthStateChange` listeners on the same client
 * is a cheap thing, and a module-level store would have to be torn down on sign
 * out to avoid leaking the previous account's identity into the next render.
 *
 * Returns null until the first `getSession` resolves, so anything gated on it
 * must be absent-then-present, never present-then-gone: the header renders the
 * learning entry in, it never blinks it out.
 */
export function usePlatformSession(): Session | null {
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    if (!isAuthConfigured()) return;

    void supabaseClient.auth.getSession().then(({ data }) => setSession(data.session));

    const {
      data: { subscription },
    } = supabaseClient.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession));

    return () => subscription.unsubscribe();
  }, []);

  return session;
}
