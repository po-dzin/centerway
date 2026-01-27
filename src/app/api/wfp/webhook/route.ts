import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Важно: crypto -> nodejs runtime
export const runtime = "nodejs";

function hmacMd5Hex(secret: string, data: string) {
  return crypto.createHmac("md5", secret).update(data, "utf8").digest("hex");
}

/**
 * WayForPay serviceUrl webhook
 * Проверка подписи:
 * merchantAccount;orderReference;amount;currency;authCode;cardPan;transactionStatus;reasonCode
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  
  const supabase = supabaseAdmin();

  const secret = process.env.WFP_SECRET_KEY;
  if (!secret) {
    return NextResponse.json({ ok: false, error: "missing_WFP_SECRET_KEY" }, { status: 500 });
  }

  const order_ref = String(body.orderReference ?? "");
  const transactionStatus = String(body.transactionStatus ?? "");
  const amount = String(body.amount ?? "");
  const currency = String(body.currency ?? "");
  const merchantAccount = String(body.merchantAccount ?? "");
  const authCode = String(body.authCode ?? "");
  const cardPan = String(body.cardPan ?? "");
  const reasonCode = String(body.reasonCode ?? "");
  const incomingSig = String(body.merchantSignature ?? "");

  // 1) Лог сырого вебхука (полезно всегда)
  await supabase.from("events").insert({
    type: "wfp_webhook_raw",
    order_ref,
    payload: body,
  });

  // 2) Проверка подписи (по докам WFP)
  const sigStr = [
    merchantAccount,
    order_ref,
    amount,
    currency,
    authCode,
    cardPan,
    transactionStatus,
    reasonCode,
  ].join(";");

  const expected = hmacMd5Hex(secret, sigStr);

  if (!incomingSig || incomingSig !== expected) {
    await supabase.from("events").insert({
      type: "wfp_bad_signature",
      order_ref,
      payload: { incomingSig, expected, sigStr },
    });

    return NextResponse.json({ ok: false, error: "bad_signature" }, { status: 401 });
  }

  // 3) Сохраняем платеж
  const provider_tx_id = body.transactionId ? String(body.transactionId) : null;

  await supabase.from("payments").insert({
    provider: "wayforpay",
    order_ref,
    provider_tx_id,
    status: transactionStatus,
    raw_payload: body,
  });

  // 4) Если Approved -> помечаем заказ как paid
  if (transactionStatus === "Approved") {
    await supabase.from("orders").update({ status: "paid" }).eq("order_ref", order_ref);

    await supabase.from("events").insert({
      type: "order_paid",
      order_ref,
      payload: { provider: "wayforpay", provider_tx_id },
    });
  }

  // 5) Отвечаем WayForPay "accept" (по докам)
  const time = Math.floor(Date.now() / 1000);
  const respStr = [order_ref, "accept", String(time)].join(";");
  const signature = hmacMd5Hex(secret, respStr);

  return NextResponse.json({
    orderReference: order_ref,
    status: "accept",
    time,
    signature,
  });
}
