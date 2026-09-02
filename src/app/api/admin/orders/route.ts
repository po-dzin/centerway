import { NextRequest, NextResponse } from "next/server";
import { adminClient } from "@/lib/auth/adminClient";
import {
    badRequestResponse,
    parseLimitOffset,
    requireAdminSession,
    serverErrorResponse,
    unauthorizedResponse,
} from "@/lib/api/adminRoute";
import { sendPurchaseEmail } from "@/lib/email/purchaseEmail";
import { loadPayableOffer } from "@/lib/platform/offers";
import { ORDER_STATUSES, isOrderStatus } from "@/lib/wfp";

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

/**
 * PATCH /api/admin/orders — manual reconcile.
 *
 * This endpoint writes the column entitlement is read from: `acceptedPaidOrders`
 * asks only whether the status reads "paid". It used to take that value straight
 * out of the request body with no allowlist, so a typo'd status silently closed
 * a paying customer's course, and any staff account could open one for free.
 *
 * Two gates now. The value must be a status the system actually has — validated
 * against `ORDER_STATUSES`, the same set the callback's transition rules are
 * written in, so the two cannot drift. And confirming money is admin-only:
 * marking an order paid creates entitlement out of nothing, which is a giveaway,
 * while `refunded` and `created` take access away and stay open to support. The
 * asymmetry is the one `moderateCourse` already uses for visibility — removing
 * something must never be gated on the state that put it there.
 */
export async function PATCH(req: NextRequest) {
    const session = await requireAdminSession(req);
    if (!session) return unauthorizedResponse();

    const { order_ref, status, note } = await req.json();
    if (!order_ref || !status) {
        return badRequestResponse("order_ref and status required");
    }

    if (!isOrderStatus(status)) {
        return badRequestResponse(`status must be one of: ${ORDER_STATUSES.join(", ")}`);
    }

    if (status === "paid" && session.role !== "admin") {
        /* A readable sentence rather than `forbiddenResponse()`: the modal shows
           this string straight to the operator, and "Forbidden" would read as a
           broken button rather than as a boundary they can hand to an admin. */
        return NextResponse.json(
            { error: "Confirming a payment requires an admin account" },
            { status: 403 }
        );
    }

    const db = adminClient();

    /* Read before writing, for two reasons that are both about the receipt: the
       previous status is what says whether this call is confirming a sale or
       re-saving one already confirmed, and the customer is who the receipt goes
       to. It also makes the audit entry say what changed rather than only what
       it changed to. */
    const { data: before, error: readError } = await db
        .from("orders")
        .select("status, product_code, customer_id")
        .eq("order_ref", order_ref)
        .maybeSingle();

    if (readError) return serverErrorResponse(readError.message);
    if (!before) return badRequestResponse("order_not_found");

    const { data, error } = await db
        .from("orders")
        .update({ status })
        .eq("order_ref", order_ref)
        .select()
        .single();

    if (error) return serverErrorResponse(error.message);

    await db.from("audit_log").insert({
        actor_id: session.user.id,
        action: "order.reconcile",
        entity_type: "order",
        entity_id: order_ref,
        metadata: { previous_status: before.status ?? null, new_status: status, note: note ?? null },
    });

    /* A sale confirmed by hand is still a sale, and the buyer has heard nothing
       — no gateway mailed them, because no gateway was involved. Only on the
       transition: re-confirming an order that already read `paid` must not mail
       a second receipt (`sendPurchaseEmail` dedupes on the order too, so this is
       belt and braces). */
    const receipt =
        status === "paid" && before.status !== "paid"
            ? await sendReconciledReceipt(db, order_ref, before.product_code, before.customer_id)
            : null;

    return NextResponse.json({ data, receipt });
}

/** The same receipt a WayForPay buyer gets, for an order confirmed in admin. */
async function sendReconciledReceipt(
    db: ReturnType<typeof adminClient>,
    orderRef: string,
    productCode: unknown,
    customerId: unknown
) {
    if (typeof customerId !== "string" || !customerId) {
        console.warn("[admin orders] reconciled to paid with no customer, no receipt sent", { orderRef });
        return { sent: false, reason: "no_customer" as const };
    }

    const { data: customer } = await db.from("customers").select("email").eq("id", customerId).maybeSingle();
    const email = typeof customer?.email === "string" ? customer.email.trim() : "";
    if (!email) {
        console.warn("[admin orders] reconciled to paid with no buyer email, no receipt sent", { orderRef });
        return { sent: false, reason: "no_email" as const };
    }

    const offer = await loadPayableOffer(productCode);
    const { data: order } = await db.from("orders").select("amount, currency").eq("order_ref", orderRef).maybeSingle();
    const amount = Number(order?.amount);

    return sendPurchaseEmail({
        email,
        productTitle: offer?.pixelContentName ?? "Ваше замовлення",
        amount: Number.isFinite(amount) && amount > 0 ? amount : null,
        currency: typeof order?.currency === "string" ? order.currency : "UAH",
        fulfilment: offer?.fulfilment ?? { kind: "cabinet" },
        orderRef,
    });
}
