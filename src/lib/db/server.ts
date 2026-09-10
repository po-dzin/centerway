import "server-only";

import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

import type { Database } from "@/lib/db/database.types";
import { env } from "@/lib/env";

/**
 * The server's two Supabase clients, and the only file that constructs them.
 *
 * `import "server-only"` is what makes the service role safe: a `"use client"`
 * file that reaches this module, however indirectly, fails the BUILD rather than
 * shipping the key. Before this the guard was a comment in supabaseAdmin.ts.
 *
 * Typed with the generated `Database`, so `.from("orders")` knows its columns.
 * A table name that does not exist is a type error, not a runtime 404.
 */
export type Db = SupabaseClient<Database>;

/**
 * The service-role client. Bypasses RLS; every read the app makes is this one.
 *
 * Constructed per call, not cached: the client holds no connection, and a
 * module-level singleton would pin the first request's env for the process.
 */
export function serviceClient(): Db {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = env.supabaseService();
  return createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

let anonClient: Db | null = null;

/**
 * The user behind an `Authorization: Bearer <jwt>` header, or null.
 *
 * Verification goes through the anon client's `auth.getUser(token)`, which
 * asks GoTrue rather than decoding the JWT locally — a revoked session is
 * refused, not merely an expired one. Three routes used to build this client
 * inline; the anon pair is stateless, so one instance serves every call.
 */
export async function verifyBearer(authHeader: string | null | undefined): Promise<User | null> {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) return null;

  if (!anonClient) {
    const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY } = env.supabasePublic();
    anonClient = createClient<Database>(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, {
      auth: { persistSession: false },
    });
  }

  const { data, error } = await anonClient.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}
