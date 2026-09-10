import { NextRequest, NextResponse } from "next/server";
import { adminClient } from "@/lib/auth/adminClient";
import { parseLimitOffset, requireAdminSession, serverErrorResponse, unauthorizedResponse } from "@/lib/api/adminRoute";
import { orIlikeFilter } from "@/lib/api/searchFilter";

// GET /api/admin/customers?q=...&limit=...&offset=...
export async function GET(req: NextRequest) {
    const session = await requireAdminSession(req);
    if (!session) return unauthorizedResponse();

    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim() ?? "";
    const { limit, offset } = parseLimitOffset(searchParams, { defaultLimit: 50, maxLimit: 100 });

    const db = adminClient();

    if (q) {
        // Search directly on the flat customers table
        const { data: direct, count: directCount, error } = await db
            .from("customers")
            .select("id, email, phone, display_name, avatar_url, tags, created_at, tg_id, google_id", { count: "exact" })
            /* Same grammar hole as the lead queue had: a `)` typed here
               returned every customer, a comma 400'd the search. */
            .or(orIlikeFilter(["email", "phone", "display_name", "tg_id", "google_id"], q) ?? "")
            .range(offset, offset + limit - 1)
            .order("created_at", { ascending: false });

        if (error) return serverErrorResponse(error.message);
        return NextResponse.json({ data: direct ?? [], count: directCount ?? 0 });
    }

    // No query — latest customers
    const { data, error, count } = await db
        .from("customers")
        .select("id, email, phone, display_name, avatar_url, tags, created_at, tg_id, google_id", { count: "exact" })
        .range(offset, offset + limit - 1)
        .order("created_at", { ascending: false });

    if (error) return serverErrorResponse(error.message);
    return NextResponse.json({ data: data ?? [], count: count ?? 0 });
}
