import { NextRequest, NextResponse } from "next/server";
import { adminClient } from "@/lib/auth/adminClient";
import type { TablesUpdate } from "@/lib/db/database.types";
import { requireAdminSession, serverErrorResponse, unauthorizedResponse } from "@/lib/api/adminRoute";
import { canonicalProductKey, resolveProductTitles } from "@/lib/analytics/productIdentity";

type OrderRow = {
  id: string;
  order_ref: string;
  product_code: string | null;
  status: string;
  amount: number | null;
  currency: string | null;
  created_at: string;
};

type EventRow = { id: string; type: string; order_ref: string | null; created_at: string };

type EnrollmentRow = {
  id: string;
  course_id: string | null;
  source: string | null;
  status: string | null;
  order_ref: string | null;
  started_at: string | null;
  expires_at: string | null;
  created_at: string;
};

type EnrollmentSummary = {
  id: string;
  course_slug: string | null;
  course_title: string | null;
  source: string | null;
  status: string | null;
  order_ref: string | null;
  expires_at: string | null;
  expired: boolean;
  last_activity_at: string | null;
  started: boolean;
  created_at: string;
};

/**
 * The access list for one signed-in customer: what they hold, until when, and
 * whether they have ever opened it.
 */
async function loadEnrollments(db: ReturnType<typeof adminClient>, authUserId: string): Promise<EnrollmentSummary[]> {
  const { data } = await db
    .from("lms_enrollments")
    .select("id, course_id, source, status, order_ref, started_at, expires_at, created_at")
    .eq("auth_user_id", authUserId)
    .order("created_at", { ascending: false });
  const rows = (data ?? []) as EnrollmentRow[];
  if (rows.length === 0) return [];

  const courseIds = [...new Set(rows.map((r) => r.course_id).filter((id): id is string => Boolean(id)))];
  const { data: courseData } = courseIds.length
    ? await db.from("lms_courses").select("id, slug, title").in("id", courseIds)
    : { data: [] };
  const courseById = new Map(
    ((courseData ?? []) as Array<{ id: string; slug: string | null; title: string | null }>).map((c) => [c.id, c]),
  );

  /* Progress is "has this person ever opened a lesson of this course",
     the same question `/admin/access` answers with its `not_started`
     status — read from the same events, so the two screens cannot
     disagree about one learner.

     Keyed by ENROLLMENT, not by learner: `lms_progress_events` has no
     user column, it hangs off the enrollment that granted the access.
     Two grants of the same course to the same person are two rows, and
     each carries the activity that happened under it. */
  const enrollmentIds = rows.map((r) => r.id).filter(Boolean);
  const { data: progressData } = enrollmentIds.length
    ? await db.from("lms_progress_events").select("enrollment_id, occurred_at").in("enrollment_id", enrollmentIds)
    : { data: [] };
  const lastSeenByEnrollment = new Map<string, string>();
  for (const row of (progressData ?? []) as Array<{ enrollment_id: string | null; occurred_at: string | null }>) {
    const at = row.occurred_at ?? "";
    if (!at || !row.enrollment_id) continue;
    const prev = lastSeenByEnrollment.get(row.enrollment_id);
    if (!prev || at > prev) lastSeenByEnrollment.set(row.enrollment_id, at);
  }

  const now = Date.now();
  return rows.map((row) => {
    const course = row.course_id ? courseById.get(row.course_id) : undefined;
    const lastActivityAt = lastSeenByEnrollment.get(row.id) ?? null;
    const expiresAt = row.expires_at;
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

// GET /api/admin/customers/[id]
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdminSession(req);
  if (!session) return unauthorizedResponse();

  const { id } = await params;
  const db = adminClient();

  // Customer record with all flat fields (email, phone, tg_id, google_id)
  const { data: customer, error: cErr } = await db.from("customers").select("*").eq("id", id).single();

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
  const enrollments: EnrollmentSummary[] = authUserId ? await loadEnrollments(db, authUserId) : [];

  /* Order labels come from the shared product vocabulary, so a course shows
     its own title here exactly as it does in the dashboard breakdown. */
  const orderRows = (orders ?? []) as OrderRow[];
  const eventRows = (events ?? []) as EventRow[];
  const orderTitles = await resolveProductTitles(
    db,
    orderRows.map((o) => o.product_code),
  );
  const orderProductLabel = (code: string | null): string | null =>
    orderTitles.get(canonicalProductKey(code)) ?? code ?? null;

  // Build unified timeline
  const timeline = [
    ...orderRows.map((o) => ({
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
    ...eventRows.map((e) => ({
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
    orders: orderRows.map((o) => ({ ...o, product_title: orderProductLabel(o.product_code) })),
    events: eventRows,
    timeline,
  });
}

// PATCH /api/admin/customers/[id]
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdminSession(req);
  if (!session) return unauthorizedResponse();

  const { id } = await params;
  const body = await req.json();
  const allowed = ["display_name", "tags", "notes", "avatar_url", "tg_id", "email", "phone"];
  // The client's Update type rejects unknown columns since supabase-js
  // 2.116; the allow-list above is what makes the cast honest.
  const patch = Object.fromEntries(
    Object.entries(body).filter(([k]) => allowed.includes(k)),
  ) as TablesUpdate<"customers">;

  const db = adminClient();
  const { data, error } = await db.from("customers").update(patch).eq("id", id).select().single();

  if (error) return serverErrorResponse(error.message);
  return NextResponse.json({ data });
}
