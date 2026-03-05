import { NextRequest, NextResponse } from "next/server";
import { adminClient } from "@/lib/auth/adminClient";
import {
    badRequestResponse,
    parseLimitOffset,
    requireAdminSession,
    serverErrorResponse,
    unauthorizedResponse,
} from "@/lib/api/adminRoute";

// GET /api/admin/orders?status=...&q=...&limit=...&offset=...
export async function GET(req: NextRequest) {
    const adminSession = await requireAdminSession(req);
    if (!adminSession) return unauthorizedResponse();

    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim() ?? "";
    const status = searchParams.get("status") ?? "";
    const { limit, offset } = parseLimitOffset(searchParams, { defaultLimit: 50, maxLimit: 200 });

    const db = adminClient();

    let query = db
        .from("orders")
        .select(
            `id, order_ref, product_code, amount, currency, status, customer_id, created_at,
       customers(id, email, phone, display_name)`,
            { count: "exact" }
        )
        .range(offset, offset + limit - 1)
        .order("created_at", { ascending: false });

    if (status) query = query.eq("status", status);
    if (q) query = query.or(`order_ref.ilike.%${q}%,product_code.ilike.%${q}%`);

    let sumQuery = db.from("orders").select("amount").eq("status", "paid");
    if (q) sumQuery = sumQuery.or(`order_ref.ilike.%${q}%,product_code.ilike.%${q}%`);
    const { data: sumData } = await sumQuery;
    const totalPaid = (sumData ?? []).reduce((s, o) => s + (Number(o.amount) ?? 0), 0);

    const { data, error, count } = await query;
    if (error) return serverErrorResponse(error.message);

    return NextResponse.json({ data: data ?? [], count: count ?? 0, totalPaid });
}

// PATCH /api/admin/orders — manual reconcile: mark order as paid
export async function PATCH(req: NextRequest) {
    const session = await requireAdminSession(req);
    if (!session) return unauthorizedResponse();

    const { order_ref, status, note } = await req.json();
    if (!order_ref || !status) {
        return badRequestResponse("order_ref and status required");
    }

    const db = adminClient();

    const { data, error } = await db
        .from("orders")
        .update({ status })
        .eq("order_ref", order_ref)
        .select()
        .single();

    if (error) return serverErrorResponse(error.message);

    // Audit log
    await db.from("audit_log").insert({
        actor_id: session.user.id,
        action: "order.reconcile",
        entity_type: "order",
        entity_id: order_ref,
        metadata: { new_status: status, note: note ?? null },
    });

    return NextResponse.json({ data });
}
