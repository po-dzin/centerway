import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export async function POST(req: NextRequest) {
  const supabase = supabaseServer();
  const body = await req.json().catch(() => null);

  if (!body) {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const order_ref = body.orderReference ?? body.order_ref ?? null;
  const status = body.transactionStatus ?? body.status ?? null;

  // raw лог (всегда)
  await supabase.from("events").insert({
    type: "wfp_webhook_raw",
    order_ref,
    payload: body,
  });

  if (!order_ref) {
    return NextResponse.json({ ok: false, error: "order_ref_missing" }, { status: 400 });
  }

  // upsert payment (без дублей)
  const { error: payErr } = await supabase.from("payments").upsert(
    {
      provider: "wayforpay",
      order_ref: String(order_ref),
      provider_tx_id: body.transactionId ?? TransactionId ?? null,
      status: String(status ?? "unknown"),
      raw_payload: body,
    },
    { onConflict: "provider,order_ref" }
  );

  if (payErr) {
    await supabase.from("events").insert({
      type: "wfp_payment_upsert_error",
      order_ref,
      payload: { payErr, body },
    });

    return NextResponse.json(
      { ok: false, error: "payments_upsert_failed", details: payErr },
      { status: 500 }
    );
  }

  // paid
  const isApproved = String(status ?? "").toLowerCase() === "approved";

  if (isApproved) {
    const { error: updErr } = await supabase
      .from("orders")
      .update({ status: "paid", updated_at: new Date().toISOString() })
      .eq("order_ref", order_ref);

    if (updErr) return NextResponse.json({ ok: false, error: updErr }, { status: 500 });

    await supabase.from("events").insert({
      type: "order_paid",
      order_ref,
      payload: { provider: "wayforpay" },
    });
  }

  return NextResponse.json({ ok: true });
}
