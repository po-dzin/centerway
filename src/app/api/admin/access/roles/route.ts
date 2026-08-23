import { NextRequest, NextResponse } from "next/server";
import { AccessError, isGrantableRole, listRoles, setRole } from "@/lib/admin/access";
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

// GET /api/admin/access/roles?q=
export async function GET(req: NextRequest) {
    const session = await requireAdminSession(req);
    if (!session) return unauthorizedResponse();

    try {
        const items = await listRoles({ q: new URL(req.url).searchParams.get("q") ?? undefined });
        // `selfId` lets the panel disable the row that would fail with
        // `cannot_change_own_role` instead of offering a control that 409s.
        return NextResponse.json({ items, canGrant: session.role === "admin", selfId: session.user.id });
    } catch (error) {
        return failed(error);
    }
}

// POST /api/admin/access/roles { email, role }
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
