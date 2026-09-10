/**
 * What every access module needs: the client type, the error, the audit write, and the account lookup.
 *
 * Split out of src/lib/admin/access.ts (1,680 lines, five aggregates) on
 * 2026-09-10. The barrel there re-exports this module; import from either.
 */

import { adminClient } from "@/lib/auth/adminClient";
import { asJson } from "@/lib/db/types";

export type AccessAccount = {
    authUserId: string;
    email: string | null;
    fullName: string | null;
    avatarUrl: string | null;
};

export type Db = ReturnType<typeof adminClient>;

/**
 * Ceiling on how many enrollments one query folds.
 *
 * Progress cannot be filtered or sorted in SQL — it is a fold over events — so
 * a status filter has to load the matching set, fold it, then paginate in
 * memory. At the current scale (tens of enrollments) that is free; the cap is
 * what keeps it from silently becoming expensive later, and `truncated` in the
 * response is what keeps it from silently lying when it does.
 */
export const FOLD_CEILING = 1000;

export class AccessError extends Error {
    constructor(message: string, readonly status: number = 400) {
        super(message);
        this.name = "AccessError";
    }
}

/** Exported so the catalogue writes its offer changes into the same log. */
export async function writeAudit(
    db: Db,
    entry: { actorId: string; action: string; entityType: string; entityId: string | null; metadata: Record<string, unknown> }
) {
    // Best-effort: an audit write that fails must not roll back a grant the
    // operator already saw succeed, but it must be visible in the server log.
    const { error } = await db.from("audit_log").insert({
        actor_id: entry.actorId,
        action: entry.action,
        entity_type: entry.entityType,
        entity_id: entry.entityId,
        metadata: asJson(entry.metadata),
    });
    if (error) console.error(`access: audit write failed for ${entry.action}`, error.message);
}

export async function accountsByIds(db: Db, ids: string[]): Promise<Map<string, AccessAccount>> {
    if (ids.length === 0) return new Map();
    const { data } = await db
        .from("platform_users")
        .select("auth_user_id, email, full_name, avatar_url")
        .in("auth_user_id", ids);

    return new Map(
        (data ?? []).map((row) => [
            row.auth_user_id as string,
            {
                authUserId: row.auth_user_id as string,
                email: row.email as string | null,
                fullName: row.full_name as string | null,
                avatarUrl: row.avatar_url as string | null,
            },
        ])
    );
}
