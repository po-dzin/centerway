import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type Body = { token: string };

export async function POST(req: NextRequest) {
  const supabase = supabaseAdmin();
  const body = (await req.json().catch(() => null)) as Body | null;

  if (!body?.token) {
    return NextResponse.json({ ok: false, error: "token required" }, { status: 400 });
  }

  const { data: t, error: tErr } = await supabase
    .from("access_tokens")
    .select("token, order_ref, used, expires_at")
    .eq("token", body.token)
    .maybeSingle();

  if (tErr) return NextResponse.json({ ok: false, error: tErr }, { status: 500 });
  if (!t) return NextResponse.json({ ok: false, error: "token_not_found" }, { status: 404 });

  const exp = new Date(t.expires_at).getTime();
  if (t.used) return NextResponse.json({ ok: false, error: "token_used" }, { status: 409 });
  if (Date.now() > exp) return NextResponse.json({ ok: false, error: "token_expired" }, { status: 410 });

  const { error: uErr } = await supabase
    .from("access_tokens")
    .update({ used: true })
    .eq("token", body.token);

  if (uErr) return NextResponse.json({ ok: false, error: uErr }, { status: 500 });

  const { data: order, error: oErr } = await supabase
    .from("orders")
    .select("order_ref, product_code, status, amount, currency, customer_id")
    .eq("order_ref", t.order_ref)
    .maybeSingle();

  if (oErr) return NextResponse.json({ ok: false, error: oErr }, { status: 500 });

  await supabase.from("events").insert({
    type: "token_consumed",
    order_ref: t.order_ref,
    customer_id: order?.customer_id ?? null,
    payload: { token: body.token },
  });

  return NextResponse.json({ ok: true, order });
}
