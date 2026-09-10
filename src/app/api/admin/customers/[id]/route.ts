import { NextRequest, NextResponse } from "next/server";
import { adminClient } from "@/lib/auth/adminClient";
import { requireAdminSession, serverErrorResponse, unauthorizedResponse } from "@/lib/api/adminRoute";
import { canonicalProductKey, resolveProductTitles } from "@/lib/reporting/productIdentity";

// GET /api/admin/customers/[id]
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await requireAdminSession(req);
    if (!session) return unauthorizedResponse();

    const { id } = await params;
    const db = adminClient();

    // Customer record with all flat fields (email, phone, tg_id, google_id)
    const { data: customer, error: cErr } = await db
        .from("customers")
        .select("*")
        .eq("id", id)
        .single();

    if (cErr || !customer) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Orders for this customer
    const { data: orders } = await db
        .from("orders")
        .select("id, order_ref, product_code, amount, currency, status, created_at")
        .eq("customer_id", id)
        .order("created_at", { ascending: false });

    // Events for this customer
    const { data: events } = await db
        .from("events")
        .select("id, type, order_ref, payload, created_at")
        .eq("customer_id", id)
        .order("created_at", { ascending: false })
        .limit(50);

    /* WHAT THIS PERSON CAN ACTUALLY OPEN.
       The card showed orders and events and stopped there, so the one question
       an operator opens a customer to answer — what do they have access to,
       until when, and have they started — had no answer on this screen. It was
       not missing data: `lms_enrollments` keys on `auth_user_id`, and
       `customers.auth_user_id` is written the moment the buyer signs in
       (`linkPurchasesToAccount`). The join simply was never made.

       A customer with no `auth_user_id` has not signed in yet. That is a real
       and common state — they bought, the receipt is in their inbox, they have
       not opened the platform — and it reads here as an empty access list
       rather than an error. */
    const authUserId = typeof customer.auth_user_id === "string" ? customer.auth_user_id : null;
    let enrollments: any[] = [];
    if (authUserId) {
        const { data: rows } = await db
            .from("lms_enrollments")
            .select("id, course_id, source, status, order_ref, started_at, expires_at, created_at")
            .eq("auth_user_id", authUserId)
            .order("created_at", { ascending: false });

        const courseIds = [...new Set((rows ?? []).map((r: any) => r.course_id).filter(Boolean))];
        const { data: courses } = courseIds.length
            ? await db.from("lms_courses").select("id, slug, title").in("id", courseIds)
            : { data: [] as any[] };
        const courseById = new Map((courses ?? []).map((c: any) => [c.id, c]));

        /* Progress is "has this person ever opened a lesson of this course",
           the same question `/admin/access` answers with its `not_started`
           status — read from the same events, so the two screens cannot
           disagree about one learner.

           Keyed by ENROLLMENT, not by learner: `lms_progress_events` has no
           user column, it hangs off the enrollment that granted the access.
           Two grants of the same course to the same person are two rows, and
           each carries the activity that happened under it. */
        const enrollmentIds = (rows ?? []).map((r: any) => r.id).filter(Boolean);
        const { data: progress } = enrollmentIds.length
            ? await db
                  .from("lms_progress_events")
                  .select("enrollment_id, occurred_at")
                  .in("enrollment_id", enrollmentIds)
            : { data: [] as any[] };
        const lastSeenByEnrollment = new Map<string, string>();
        for (const row of (progress ?? []) as any[]) {
            const at = String(row.occurred_at ?? "");
            if (!at) continue;
            const prev = lastSeenByEnrollment.get(row.enrollment_id);
            if (!prev || at > prev) lastSeenByEnrollment.set(row.enrollment_id, at);
        }

        const now = Date.now();
        enrollments = (rows ?? []).map((row: any) => {
            const course = courseById.get(row.course_id);
            const lastActivityAt = lastSeenByEnrollment.get(row.id) ?? null;
            const expiresAt = typeof row.expires_at === "string" ? row.expires_at : null;
            return {
                id: row.id,
                course_slug: course?.slug ?? null,
                course_title: course?.title ?? null,
                source: row.source,
                status: row.status,
                order_ref: row.order_ref,
                expires_at: expiresAt,
                expired: expiresAt ? Date.parse(expiresAt) < now : false,
                last_activity_at: lastActivityAt,
                started: Boolean(lastActivityAt),
                created_at: row.created_at,
            };
        });
    }

    /* Order labels come from the shared product vocabulary, so a course shows
       its own title here exactly as it does in the dashboard breakdown. */
    const orderTitles = await resolveProductTitles(
        db,
        (orders ?? []).map((o: any) => o.product_code)
    );
    const orderProductLabel = (code: string | null) =>
        orderTitles.get(canonicalProductKey(code)) ?? code ?? null;

    // Build unified timeline
    const timeline = [
        ...(orders ?? []).map((o: any) => ({
            ts: o.created_at,
            type: "order" as const,
            /* The label used to be built here as `Заказ ${ref} — ${status}` —
               a Russian string assembled on the server, in a product that
               speaks Ukrainian on «ви» and translates every other label in the
               client. The server now sends the FACTS and the screen writes the
               sentence. */
            label: orderProductLabel(o.product_code) ?? o.order_ref,
            sub: o.amount ? `${o.amount} ${o.currency ?? ""}`.trim() : null,
            id: o.id,
            ref: o.order_ref,
            status: o.status,
            product_code: o.product_code,
        })),
        ...(events ?? []).map((e: any) => ({
            ts: e.created_at,
            type: "event" as const,
            label: e.type,
            sub: e.order_ref ?? null,
            id: e.id,
        })),
    ].sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());

    return NextResponse.json({
        customer,
        enrollments,
        orders: (orders ?? []).map((o: any) => ({ ...o, product_title: orderProductLabel(o.product_code) })),
        events: events ?? [],
        timeline,
    });
}

// PATCH /api/admin/customers/[id]
export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await requireAdminSession(req);
    if (!session) return unauthorizedResponse();

    const { id } = await params;
    const body = await req.json();
    const allowed = ["display_name", "tags", "notes", "avatar_url", "tg_id", "email", "phone"];
    const patch = Object.fromEntries(
        Object.entries(body).filter(([k]) => allowed.includes(k))
    );

    const db = adminClient();
    const { data, error } = await db
        .from("customers")
        .update(patch)
        .eq("id", id)
        .select()
        .single();

    if (error) return serverErrorResponse(error.message);
    return NextResponse.json({ data });
}
