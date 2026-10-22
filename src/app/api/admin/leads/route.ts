import { NextRequest, NextResponse } from "next/server";
import { adminClient } from "@/lib/auth/adminClient";
import {
  badRequestResponse,
  forbiddenResponse,
  parseLimitOffset,
  requireAdminSession,
  serverErrorResponse,
  unauthorizedResponse,
} from "@/lib/api/adminRoute";
import { loadProductIdentity } from "@/lib/analytics/productIdentity";
import { LEAD_STAGES, isLeadStage } from "@/lib/platform/leadStage";
import { orIlikeFilter } from "@/lib/api/searchFilter";
import { writeAudit } from "@/lib/admin/access/shared";

/**
 * The lead queue.
 *
 * `leads` had no surface in the admin at all — the only mention of the word
 * anywhere in `/admin` was a counter on the dashboard reading a table with two
 * rows in it. A form submission was therefore something you learned about from
 * Telegram and then held in your head.
 *
 * The stage vocabulary lives in `@/lib/platform/leadStage`, not here: a Next
 * route file may only export the fields Next recognises, and `next build`
 * rejects anything else outright even though tsc, lint and the tests are happy.
 */

// GET /api/admin/leads?stage=&q=&limit=&offset=
export async function GET(req: NextRequest) {
  const session = await requireAdminSession(req);
  if (!session) return unauthorizedResponse();

  const { searchParams } = new URL(req.url);
  const stage = searchParams.get("stage")?.trim() ?? "";
  const q = searchParams.get("q")?.trim() ?? "";
  const { limit, offset } = parseLimitOffset(searchParams, { defaultLimit: 50, maxLimit: 100 });

  const db = adminClient();
  let query = db
    .from("leads")
    .select("id, order_ref, product_code, source, name, email, phone, stage, stage_changed_at, created_at, payload", {
      count: "exact",
    });

  if (stage) {
    if (!isLeadStage(stage)) return badRequestResponse("stage_invalid");
    query = query.eq("stage", stage);
  }
  /* Quoted, not interpolated: a `)` typed into this box used to return every
       lead in the table and a comma used to 400 the request. See searchFilter.ts. */
  const search = orIlikeFilter(["name", "email", "phone", "order_ref"], q);
  if (search) {
    query = query.or(search);
  }

  const { data, error, count } = await query
    .range(offset, offset + limit - 1)
    .order("created_at", { ascending: false });

  if (error) return serverErrorResponse(error.message);

  const rows = data ?? [];

  /* The product a lead asked about wears the same name here as it does in the
       dashboard breakdown and on the customer card — one vocabulary, so nobody
       has to learn that `course:natural-body` and «Природнє тіло з Аюрведою»
       are the same thing. */
  const identity = await loadProductIdentity(db);

  /* Counts per stage for the tab strip. Cheap head-only queries: the operator
       needs to see that four leads are waiting without opening the tab, and a
       tab strip that silently shows nothing is why a queue stops being worked. */
  const counts: Record<string, number> = {};
  await Promise.all(
    LEAD_STAGES.map(async (value) => {
      const { count: stageCount } = await db
        .from("leads")
        .select("id", { count: "exact", head: true })
        .eq("stage", value);
      counts[value] = stageCount ?? 0;
    }),
  );

  return NextResponse.json({
    canDelete: session.role === "admin",
    data: rows.map((row) => {
      /* `payload` is `Json`, which is a string or an array just as
               legitimately as it is an object — a lead written by a door we do
               not control could carry either. Read the fields off it only once
               it is actually a record. */
      const payload = row.payload && typeof row.payload === "object" && !Array.isArray(row.payload) ? row.payload : {};
      return {
        ...row,
        product_title: identity.title(row.product_code) ?? row.product_code ?? null,
        /* Surfaced rather than left buried in the payload: an operator
                   calling this person wants to know which dosha they got before
                   they pick up the phone. `dosha_result_type` is verified against a
                   completed attempt; `dosha_claimed` is only what the page said. */
        dosha_result_type: payload.dosha_result_type ?? null,
        dosha_claimed: payload.dosha_claimed ?? null,
        message: payload.message ?? null,
        payload: undefined,
      };
    }),
    count: count ?? 0,
    counts,
  });
}

// PATCH /api/admin/leads  { id, stage }
export async function PATCH(req: NextRequest) {
  const session = await requireAdminSession(req);
  if (!session) return unauthorizedResponse();

  const body = (await req.json().catch(() => ({}))) as { id?: unknown; stage?: unknown };
  const id = typeof body.id === "string" ? body.id.trim() : "";
  if (!id) return badRequestResponse("id_required");
  if (!isLeadStage(body.stage)) return badRequestResponse("stage_invalid");

  const db = adminClient();
  const { data, error } = await db
    .from("leads")
    /* `stage_changed_at` is written here and never by the form: it means
           "a person moved this", which is exactly the thing a NULL still
           distinguishes from a row sitting at its default. */
    .update({ stage: body.stage, stage_changed_at: new Date().toISOString() })
    .eq("id", id)
    .select("id, stage, stage_changed_at")
    .single();

  if (error) return serverErrorResponse(error.message);
  return NextResponse.json({ data });
}

// DELETE /api/admin/leads?id=...
/* A request is removed for good, and only by an admin: a support operator moves
   a lead along the stages, never takes it off the list. Test requests (a
   smoke run, a typo'd number) had no way out before; the row's own facts go to
   the audit log, so what was removed is still answerable. */
export async function DELETE(req: NextRequest) {
  const session = await requireAdminSession(req);
  if (!session) return unauthorizedResponse();
  if (session.role !== "admin") return forbiddenResponse();

  const id = new URL(req.url).searchParams.get("id")?.trim() ?? "";
  if (!id) return badRequestResponse("id_required");

  const db = adminClient();
  const { data: lead, error: readError } = await db
    .from("leads")
    .select("id, order_ref, product_code, name, email, phone, stage, created_at")
    .eq("id", id)
    .maybeSingle();
  if (readError) return serverErrorResponse(readError.message);
  if (!lead) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const { error } = await db.from("leads").delete().eq("id", id);
  if (error) return serverErrorResponse(error.message);

  await writeAudit(db, {
    actorId: session.user.id,
    action: "lead.delete",
    entityType: "lead",
    entityId: id,
    metadata: {
      order_ref: lead.order_ref,
      product_code: lead.product_code,
      stage: lead.stage,
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      created_at: lead.created_at,
    },
  });

  return NextResponse.json({ ok: true });
}
