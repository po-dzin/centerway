import { NextRequest, NextResponse } from "next/server";
import { AccessError, isGrantableRole, setRole } from "@/lib/admin/access";
import {
    badRequestResponse,
    forbiddenResponse,
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

/**
 * POST /api/admin/access/roles { email, role }
 *
 * There is no GET any more. It backed a Roles TABLE — the accounts holding an
 * elevated role — and that table was the accounts list filtered by an attribute
 * of the account, which is a facet rather than a tab. `/access/accounts?role=`
 * answers it now, from the one list, so this route is only the write.
 * See docs/admin-access-shape-2026-08-28.md.
 */
export async function POST(req: NextRequest) {
    const session = await requireAdminSession(req);
    if (!session) return unauthorizedResponse();
    // `support` may read the role map and hand out course access, but handing
    // out roles — including admin — stays with admin.
    if (session.role !== "admin") return forbiddenResponse();

    const body = (await req.json().catch(() => ({}))) as { email?: string; role?: string };
    if (!body.email || !isGrantableRole(body.role)) return badRequestResponse("email_and_valid_role_required");

    try {
        const result = await setRole({ email: body.email, role: body.role, actorId: session.user.id });
        return NextResponse.json({
            email: result.account.email,
            previous: result.previous,
            role: result.role,
        });
    } catch (error) {
        return failed(error);
    }
}
