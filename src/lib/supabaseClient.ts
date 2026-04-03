import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Browser-safe Supabase client (anon role).
 * Must never throw at module import time, otherwise static prerender/build fails
 * in environments where NEXT_PUBLIC_SUPABASE_* is intentionally absent.
 */

let cachedClient: SupabaseClient | null = null;

function buildClient(): SupabaseClient | null {
  if (cachedClient) return cachedClient;
  if (typeof window === "undefined") return null;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) return null;

  cachedClient = createClient(supabaseUrl, supabaseKey);
  return cachedClient;
}

type NoopAuth = {
  getSession: () => Promise<{ data: { session: null } }>;
  onAuthStateChange: () => { data: { subscription: { unsubscribe: () => void } } };
  signInWithOAuth: () => Promise<{ data: { provider?: string; url?: string | null }; error: null }>;
  signOut: () => Promise<{ error: null }>;
};

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
