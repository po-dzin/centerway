"use client";

import type { Session } from "@supabase/supabase-js";

import { useSession } from "@/components/auth/SessionProvider";

export { isAuthConfigured } from "@/components/auth/SessionProvider";

/**
 * The signed-in session, or null.
 *
 * Reads the root layout's SessionProvider (one subscription for the whole
 * tree) rather than subscribing itself, which is what it did when it was
 * extracted from PlatformProfileEntry. Returns null until the first
 * `getSession` resolves, so anything gated on it must be absent-then-present,
 * never present-then-gone: the header renders the learning entry in, it never
 * blinks it out.
 */
export function usePlatformSession(): Session | null {
  return useSession().session;
}
