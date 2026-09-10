import { NextRequest, NextResponse } from "next/server";

import { listCustomers } from "@/lib/admin/customers";
import { parseLimitOffset, requireAdminSession, serverErrorResponse, unauthorizedResponse } from "@/lib/api/adminRoute";

// GET /api/admin/customers?q=...&limit=...&offset=...
export async function GET(req: NextRequest) {
    const session = await requireAdminSession(req);
    if (!session) return unauthorizedResponse();

    const { searchParams } = new URL(req.url);
    const { limit, offset } = parseLimitOffset(searchParams, { defaultLimit: 50, maxLimit: 100 });
    try {
        return NextResponse.json(await listCustomers({ q: searchParams.get("q") ?? "", limit, offset }));
    } catch (error) {
        return serverErrorResponse(error instanceof Error ? error.message : "customers_failed");
    }
}
