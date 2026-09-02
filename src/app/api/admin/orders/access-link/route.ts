import { NextRequest, NextResponse } from "next/server";
import { badRequestResponse, forbiddenResponse, requireAdminSession } from "@/lib/api/adminRoute";
import { fulfilmentDestination, orderFulfilment } from "@/lib/fulfilmentDestination";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * The operator's "resend access" answer: where does this buyer's purchase live?
 *
 * REPLACES `/api/tokens/create`, which minted a 30-minute `access_tokens` row
 * and let the admin page paste it into `/pay/return?token=…`. That route reads
 * `order_ref` and has never read `token`, so it found nothing and redirected to
 * the payment-failed page — the operator's only repair tool sent the person
 * they were repairing to «Платіж не завершився».
 *
 * The token was not merely a broken carrier, it was an obsolete one. Access
 * tokens stopped deciding entitlement on 2026-08-29 (see the note in
 * `lms-core/access.ts`); since then a paid order entitles on its own and the
 * token grants nothing, revokes nothing and is consumed by nobody. So there is
 * no link to mint — only a link to STATE, and the receipt email has always
 * known how to state it. Both now call `fulfilmentDestination`.
 *
 * Support, not just admin: handing a paying customer the address of the thing
 * they bought is support's daily work and moves no money. `PATCH /orders`
 * draws the admin line where money is, and this is on the other side of it.
 */
export async function POST(req: NextRequest) {
  const session = await requireAdminSession(req);
  if (!session) return forbiddenResponse();

  const body = (await req.json().catch(() => null)) as { order_ref?: unknown } | null;
  const orderRef = typeof body?.order_ref === "string" ? body.order_ref.trim() : "";
  if (!orderRef) return badRequestResponse("order_ref required");

  const supabase = supabaseAdmin();
  const { data: order, error } = await supabase
    .from("orders")
    .select("order_ref, product_code, status")
    .eq("order_ref", orderRef)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message ?? "order_lookup_failed" }, { status: 500 });
  }
  if (!order) {
    return NextResponse.json({ ok: false, error: "order_not_found" }, { status: 404 });
  }

  /* The link is the truth about the PRODUCT, not about the payment, so it is
     built for any order — but an unpaid one is worth saying out loud. An
     operator copying a link for an order that never completed is either about
     to hand out a course for free or looking at the wrong row, and both are
     better interrupted here than discovered later. */
  const { href, label } = fulfilmentDestination(orderFulfilment(order.product_code));

  await supabase.from("events").insert({
    type: "access_link_issued",
    order_ref: order.order_ref,
    payload: { href, issued_by: session.user.id, order_status: order.status ?? null },
  });

  return NextResponse.json({
    ok: true,
    link: href,
    label,
    paid: order.status === "paid",
  });
}
