import { NextRequest, NextResponse } from "next/server";
import { AccessError, isGrantableRole, listAccounts } from "@/lib/admin/access";
import {
    parseLimitOffset,
    requireAdminSession,
    serverErrorResponse,
    unauthorizedResponse,
} from "@/lib/api/adminRoute";

function failed(error: unknown) {
    if (error instanceof AccessError) {
        return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return serverErrorResponse(error instanceof Error ? error.message : "unknown_error");
}

// GET /api/admin/access/accounts?q=&role=&limit=&offset=
export async function GET(req: NextRequest) {
    const session = await requireAdminSession(req);
    if (!session) return unauthorizedResponse();

    const { searchParams } = new URL(req.url);
    const parsed = parseLimitOffset(searchParams, { defaultLimit: 50, maxLimit: 100 });
    // `parseLimitOffset` hands a non-numeric ?limit= straight through as NaN,
    // which reads back as an empty page — "no accounts" rather than the bad
    // request it is. Same guard as the learners route.
    const limit = Number.isFinite(parsed.limit) && parsed.limit > 0 ? parsed.limit : 50;
    const offset = Number.isFinite(parsed.offset) && parsed.offset >= 0 ? parsed.offset : 0;

    try {
        // An unknown ?role= is dropped rather than passed on, the same way the
        // learners route drops an unknown ?status=: filtering on nonsense should
        // read as "no filter", not as "no people".
        const role = searchParams.get("role") ?? "";
        const result = await listAccounts({
            q: searchParams.get("q") ?? undefined,
            role: role === "staff" || isGrantableRole(role) ? role : undefined,
            limit,
            offset,
        });
        // `canGrant` mirrors the roles route: `support` may read this list and
        // hand out a course, but the role control stays with admin.
        return NextResponse.json({
            ...result,
            limit,
            offset,
            canGrant: session.role === "admin",
            selfId: session.user.id,
        });
    } catch (error) {
        return failed(error);
    }
}
