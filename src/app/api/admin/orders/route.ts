import { NextRequest, NextResponse } from "next/server";
import { adminClient } from "@/lib/auth/adminClient";
import { requireAdmin } from "@/lib/auth/requireAdmin";

// GET /api/admin/orders?status=...&q=...&limit=...&offset=...
export async function GET(req: NextRequest) {
    const session = await requireAdmin(req);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim() ?? "";
    const status = searchParams.get("status") ?? "";
    const limit = Math.min(Number(searchParams.get("limit") ?? 50), 200);
    const offset = Number(searchParams.get("offset") ?? 0);

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
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ data: data ?? [], count: count ?? 0, totalPaid });
}

// PATCH /api/admin/orders — manual reconcile: mark order as paid
export async function PATCH(req: NextRequest) {
    const session = await requireAdmin(req);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { order_ref, status, note } = await req.json();
    if (!order_ref || !status) {
        return NextResponse.json({ error: "order_ref and status required" }, { status: 400 });
    }

    const db = adminClient();

    const { data, error } = await db
        .from("orders")
        .update({ status })
        .eq("order_ref", order_ref)
        .select()
        .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

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
