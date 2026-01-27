import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import crypto from "crypto";

function sha1(data: string) {
  return crypto.createHash("sha1").update(data).digest("hex");
}

function buildSignatureString(body: any) {
  const merchantAccount = body.merchantAccount ?? "";
  const orderReference = body.orderReference ?? "";
  const amount = body.amount ?? "";
  const currency = body.currency ?? "";
  const authCode = body.authCode ?? "";
  const cardPan = body.cardPan ?? "";
  const transactionStatus = body.transactionStatus ?? "";
  const reasonCode = body.reasonCode ?? "";

  return [
    merchantAccount,
    orderReference,
    amount,
    currency,
    authCode,
    cardPan,
    transactionStatus,
    reasonCode,
  ].join(";");
}

export async function POST(req: NextRequest) {
  const supabase = supabaseServer();
  const body = await req.json().catch(() => null);

  if (!body) {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const order_ref = body.orderReference ?? body.order_ref ?? null;
  const status = body.transactionStatus ?? body.status ?? null;

  // 1) raw лог
  await supabase.from("events").insert({
    type: "wfp_webhook_raw",
    order_ref,
    payload: body,
  });

  if (!order_ref) {
    return NextResponse.json({ ok: false, error: "order_ref_missing" }, { status: 400 });
  }

  // 2) signature check (если поле присутствует)
  const secret = process.env.WFP_SECRET_KEY ?? "";
  const incomingSig = body.merchantSignature ?? body.signature ?? null;

  if (incomingSig && secret) {
    const sigStr = buildSignatureString(body);
    const expected = sha1(secret + sigStr);

    // WayForPay иногда шлёт в upper-case
    const okSig =
      String(incomingSig).toLowerCase() === String(expected).toLowerCase();

    if (!okSig) {
      await supabase.from("events").insert({
        type: "wfp_bad_signature",
     ncomingSig, expected, sigStr },
      });

      return NextResponse.json({ ok: false, error: "bad_signature" }, { status: 401 });
    }
  }

  // 3) upsert payment (без дублей)
  const { error: payErr } = await supabase.from("payments").upsert(
    {
      provider: "wayforpay",
      order_ref: String(order_ref),
      provider_tx_id: body.transactionId ?? body.paymentSystemTransactionId ?? null,
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

    return NextResponse.json({ ok: false, error: "payments_upsert_failed", details: payErr }, { status: 500 });
  }

  // 4) paid
  const isApproved = String(status ?? "").toLowerCase() === "approved";

  if (isApproved) {
    const { error: updErr } = await supabase
      .from("orders")
      .update({ status: "paid", updated_ate().toISOString() })
      .eq("order_ref", order_ref);

    if (updErr) return NextResponse.json({ ok: false, error: updErr }, { status: 500 });

    await supabase.from("events").insert({
      type: "order_paid",
      order_ref,
      payload: { provider: "wayforpay" },
    });
  }

  // 5) WayForPay часто ожидает plain "OK" или json — оставим json
  return NextResponse.json({ ok: true });
}
