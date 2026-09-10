/**
 * Elevated roles, and the one write that hands them out.
 *
 * Split out of src/lib/admin/access.ts (1,680 lines, five aggregates) on
 * 2026-09-10. The barrel there re-exports this module; import from either.
 */

import { adminClient } from "@/lib/auth/adminClient";
import type { GrantableRole } from "@/lib/admin/accessTypes";
import { resolveAccountByEmail } from "./accounts";
import { AccessError, writeAudit } from "./shared";

export async function setRole(input: { email: string; role: GrantableRole; actorId: string }) {
    const db = adminClient();
    const account = await resolveAccountByEmail(db, input.email);

    if (account.authUserId === input.actorId) {
        // A panel that can demote its own operator can lock the last admin out
        // of the panel. Changing your own role stays a deliberate CLI act.
        throw new AccessError("cannot_change_own_role", 409);
    }

    const { data: current } = await db
        .from("user_roles")
        .select("role")
        .eq("user_id", account.authUserId)
        .maybeSingle();
    const previous = current?.role ? String(current.role).toLowerCase() : null;

    const { error } = await db
        .from("user_roles")
        .upsert(
            { user_id: account.authUserId, role: input.role, updated_at: new Date().toISOString() },
            { onConflict: "user_id" }
        );
    if (error) throw new AccessError(error.message, 500);

    await writeAudit(db, {
        actorId: input.actorId,
        action: "access.role.set",
        entityType: "user_role",
        entityId: account.authUserId,
        metadata: {
            grantee_email: account.email,
            role_before: previous,
            role_after: input.role,
        },
    });

    return { account, previous, role: input.role };
}
