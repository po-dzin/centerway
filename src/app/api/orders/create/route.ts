import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseServer } from "@/lib/supabaseServer";

type Body = {
  product_code: "short" | "irem";
  amount?: number;
  currency?: string;
  tg_user_id?: string;
  email?: string;
  phone?: string;
};

function makeOrderRef(product: string) {
  const stamp = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const rnd = crypto.randomBytes(4).toString("hex");
  return `${product}_${stamp}_${rnd}`;
}

export async function POST(req: NextRequest) {
  const supabase = supabaseServer();
  const body = (await req.json().catch(() => null)) as Body | null;

  if (!body?.product_code) {
    return NextResponse.json({ ok: false, error: "product_code required" }, { status: 400 });
  }

  if (body.product_code !== "short" && body.product_code !== "irem") {
    return NextResponse.json({ ok: false, error: "invalid product_code" }, { status: 400 });
  }

  const product_code = body.product_code;
  const amount = body.amount ?? null;
  const currency = body.currency ?? "UAH";

  let customerId: string | null = null;

  // 1) upsert customer
  if (body.tg_user_id) {
    const { data, error } = await supabase
      .from("customers")
      .upsert(
        { tg_user_id: body.tg_user_id, email: body.email ?? null, phone: body.phone ?? null },
        { onConflict: "tg_user_id" }
      )
      .select("id")
      .single();

    if (error) return NextResponse.json({ ok: false, error }, { status: 500 });
    customerId = data.id;
  } else if (body.email) {
    const { data, error } = await supabase
      .from("customers")
      .upsert({ email: body.email, phone: body.phone ?? null }, { onConflict: "email" })
      .select("id")
      .single();

    if (error) return NextResponse.json({ ok: false, error }, { status: 500 });
    customerId = data.id;
  } else if (body.phone) {
    const { data, error } = await supabase
      .from("customers")
      .upsert({ phone: body.phone }, { onConflict: "phone" })
      .select("id")
      .single();

    if (error) return NextResponse.json({ ok: false, error }, { status: 500 });
    customerId = data.id;
  }

  // 2) create order
  const order_ref = makeOrderRef(product_code);

  const { error: orderErr } = await supabase.from("orders").insert({
    order_ref,
    product_code,
    amount,
    currency,
    status: "created",
    customer_id: customerId,
  });

  if (orderErr) return NextResponse.json({ ok: false, error: orderErr }, { status: 500 });

  // 3) log event
  await supabase.from("events").insert({
    type: "order_created",
    order_ref,
    customer_id: customerId,
    payload: { product_code, amount, currency, tg_user_id: body.tg_user_id ?? null },
  });

  return NextResponse.json({ ok: true, order_ref, customer_id: customerId });
}
