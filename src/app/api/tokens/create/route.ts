import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseServer } from "@/lib/supabaseServer";

type Body = { order_ref: string };

export async function POST(req: NextRequest) {
  const supabase = supabaseServer();
  const body = (await req.json().catch(() => null)) as Body | null;

  if (!body?.order_ref) {
    return NextResponse.json({ ok: false, error: "order_ref required" }, { status: 400 });
  }

  const token = crypto.randomBytes(16).toString("hex");
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30 min

  const { error: tokenErr } = await supabase.from("access_tokens").insert({
    token,
    order_ref: body.order_ref,
    expires_at: expiresAt,
  });

  if (tokenErr) {
    return NextResponse.json({ ok: false, error: tokenErr }, { status: 500 });
  }

  const { error: eventErr } = await supabase.from("events").insert({
    type: "token_created",
    order_ref: body.order_ref,
    payload: { token, expiresAt },
  });

  if (eventErr) {
    // токен уже создан, но лог не записался — не критично
    return NextResponse.json({ ok: true, token, expiresAt, warn: "event_log_failed" });
  }

  return NextResponse.json({ ok: true, token, expiresAt });
}
