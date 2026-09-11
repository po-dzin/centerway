import "server-only";

import { createServerClient } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";
import { cookies } from "next/headers";

import { serviceClient } from "@/lib/db/server";
import { env, hasPublicSupabaseEnv } from "@/lib/env";
import { isAdminRole } from "@/lib/platform/adminRole";

/**
 * THE SESSION, READ ON THE SERVER.
 *
 * The browser client has kept the session in cookies scoped to
 * `.centerway.net.ua` since the cabinet moved to `my` (src/lib/supabaseClient.ts),
 * and until 2026-09-10 nothing on the server read them: every authenticated
 * surface fetched with a Bearer header from the client, and the admin shell
 * learned the role after hydration and redirected then. A server component
 * can know both before it renders a byte.
 *
 * `getUser()` asks GoTrue rather than decoding the JWT locally, so a revoked
 * session is refused. When the access token has expired and the refresh
 * token is good, the library refreshes and tries to write the new cookies —
 * which a server component cannot do. The write is swallowed: the browser
 * client refreshes on its own side, and the refreshed user is still returned
 * here for this render.
 */
export async function userFromCookies(): Promise<User | null> {
  if (!hasPublicSupabaseEnv()) return null;
  const store = await cookies();
  const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY } = env.supabasePublic();
  const client = createServerClient(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          // A server component may not set cookies. See above.
        }
      },
    },
  });
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
}

export type StaffSession = { user: User; role: "admin" | "support" };

/** The signed-in user as a member of staff, or null. Roles live in `user_roles` only. */
export async function staffFromCookies(): Promise<StaffSession | null> {
  const user = await userFromCookies();
  if (!user) return null;
  const { data } = await serviceClient().from("user_roles").select("role").eq("user_id", user.id).maybeSingle();
  const role = String(data?.role ?? "").toLowerCase();
  if (!isAdminRole(role)) return null;
  return { user, role: role as StaffSession["role"] };
}
