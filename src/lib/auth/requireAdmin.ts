import type { NextRequest } from "next/server";

import { serviceClient, verifyBearer } from "@/lib/db/server";
import { log } from "@/lib/logger";

export type AdminSession = {
  user: NonNullable<Awaited<ReturnType<typeof verifyBearer>>>;
  role: "admin" | "support";
};

/**
 * The caller as a member of staff, or null.
 *
 * Roles live in `user_roles` only (platform_users.role was removed 2026-08-21
 * as a self-promotion hole). The value is compared lowercased because rows
 * written by hand carried "Admin" beside "admin"; the returned role is the
 * normalized form, so callers compare against two strings, not four.
 */
export async function requireAdmin(req: NextRequest): Promise<AdminSession | null> {
  const user = await verifyBearer(req.headers.get("Authorization"));
  if (!user) return null;

  const { data, error } = await serviceClient().from("user_roles").select("role").eq("user_id", user.id).maybeSingle();

  if (error) {
    log.error("auth.role_fetch_failed", { userId: user.id, message: error.message });
    return null;
  }
  const role = String(data?.role ?? "").toLowerCase();
  if (role !== "admin" && role !== "support") return null;
  return { user, role };
}
