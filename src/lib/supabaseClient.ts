import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

import { legacySessionStorageKey, sessionCookieOptions } from "./auth/sessionCookie";

/**
 * Browser-safe Supabase client (anon role).
 * Must never throw at module import time, otherwise static prerender/build fails
 * in environments where NEXT_PUBLIC_SUPABASE_* is intentionally absent.
 *
 * THE SESSION LIVES IN A COOKIE, not in `localStorage`. `localStorage` is
 * per-origin, so the builder on its own host had its own session and an author
 * signed in twice; the app switcher could not switch, only offer a second
 * login. A cookie scoped to `.centerway.net.ua` is shared by every surface
 * under it. What that costs, and the alternative, is in `auth/sessionCookie.ts`.
 *
 * `createBrowserClient` rather than a hand-rolled storage adapter, because a
 * stored session is ~3.2KB of JSON and a cookie holds 4096 bytes — it has to be
 * split across several, and that chunking is the library's job, not ours.
 *
 * The SERVER side is untouched: `requireUser` and `requireAdmin` take a Bearer
 * token, never a cookie, which is also what keeps the API usable from a native
 * client (docs/lms-research-2026-08-15.md §5A).
 */

let cachedClient: SupabaseClient | null = null;

/**
 * Carries a session written before the switch into the cookie.
 *
 * Without this, shipping the change signs everybody out at once: their session
 * sits in a `localStorage` key the new client never reads. Writing it back
 * through `setSession` lets the library own the cookie format, and emits
 * `SIGNED_IN`, which every shell is already subscribed to — so the surface
 * updates rather than waiting for a reload.
 *
 * Runs once, and clears the old key either way: kept, it would be a copy of a
 * live credential in a place nothing reads.
 */
async function adoptLegacySession(client: SupabaseClient, supabaseUrl: string): Promise<void> {
  const key = legacySessionStorageKey(supabaseUrl);
  if (!key) return;

  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(key);
  } catch {
    return; // storage disabled — nothing to carry
  }
  if (!raw) return;

  try {
    // Only when the cookie has nothing. A cookie session is the newer of the
    // two by construction, and overwriting it with the old one could downgrade
    // a fresh sign-in to a stale token.
    const { data } = await client.auth.getSession();
    if (!data.session) {
      const parsed = JSON.parse(raw) as { access_token?: string; refresh_token?: string };
      if (parsed?.access_token && parsed?.refresh_token) {
        await client.auth.setSession({
          access_token: parsed.access_token,
          refresh_token: parsed.refresh_token,
        });
      }
    }
  } catch {
    // A corrupt or expired legacy value is not worth failing over: the person
    // signs in again, which is the same outcome as before this existed.
  } finally {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // ignore storage write errors
    }
  }
}

function buildClient(): SupabaseClient | null {
  if (cachedClient) return cachedClient;
  if (typeof window === "undefined") return null;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) return null;

  cachedClient = createBrowserClient(supabaseUrl, supabaseKey, {
    cookieOptions: sessionCookieOptions(window.location.host, window.location.protocol),
  });
  void adoptLegacySession(cachedClient, supabaseUrl);
  return cachedClient;
}

type NoopAuthError = { message: string; status?: number };

type NoopAuth = {
  getSession: () => Promise<{ data: { session: null } }>;
  onAuthStateChange: () => { data: { subscription: { unsubscribe: () => void } } };
  signInWithOAuth: () => Promise<{ data: { provider?: string; url?: string | null }; error: null }>;
  /* The email pair reports an error rather than a cheerful null. A caller that
     asked us to send a code has to be told that no code was sent — the OAuth
     stub can stay silent because a redirect that does not happen is visible on
     screen, while a code that never arrives looks exactly like a slow inbox. */
  signInWithOtp: () => Promise<{ data: { user: null; session: null }; error: NoopAuthError }>;
  verifyOtp: () => Promise<{ data: { user: null; session: null }; error: NoopAuthError }>;
  signOut: () => Promise<{ error: null }>;
};

const authUnavailable: NoopAuthError = { message: "auth_unavailable" };

const noopAuth: NoopAuth = {
  getSession: async () => ({ data: { session: null } }),
  onAuthStateChange: () => ({
    data: {
      subscription: {
        unsubscribe: () => undefined,
      },
    },
  }),
  signInWithOAuth: async () => ({ data: { provider: "google", url: null }, error: null }),
  signInWithOtp: async () => ({ data: { user: null, session: null }, error: authUnavailable }),
  verifyOtp: async () => ({ data: { user: null, session: null }, error: authUnavailable }),
  signOut: async () => ({ error: null }),
};

export const supabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = buildClient();
    if (client) {
      return (client as unknown as Record<PropertyKey, unknown>)[prop];
    }
    if (prop === "auth") return noopAuth;
    return undefined;
  },
});
