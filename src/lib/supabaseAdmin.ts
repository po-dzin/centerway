import { createClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase client (service role).
 * DO NOT import this in browser code.
 */
export function supabaseAdmin() {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  if (!url) throw new Error("Missing SUPABASE_URL");
  if (!key) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");

  return createClient(url, key, {
    auth: { persistSession: false },
  });
}
