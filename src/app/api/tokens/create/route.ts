import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { forbiddenResponse, requireAdminSession } from "@/lib/api/adminRoute";

type Body = { order_ref: string };

/**
 * Mints a fresh access link for an order. This is an operator tool — the only
 * caller is the «resend access» button on /admin/orders — and it must stay one.
 *
 * An access token is not merely additive: an order carrying an EXPIRED token is
 * skipped by `resolveEntitlement`, so minting a token against somebody else's
 * order_ref and waiting half an hour used to lock a paying learner out of the
 * course they bought. Order refs travel in return URLs, so they are not secret
 * enough to be the only thing standing between a stranger and that.
 */
export async function POST(req: NextRequest) {
  const session = await requireAdminSession(req);
  if (!session) return forbiddenResponse();

  const supabase = supabaseAdmin();
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
    return NextResponse.json({ ok: false, error: tokenErr.message ?? "token_insert_failed" }, { status: 500 });
  }

  const { error: eventErr } = await supabase.from("events").insert({
    type: "token_created",
    order_ref: body.order_ref,
    payload: { token, expiresAt, issued_by: session.user.id },
  });

  if (eventErr) {
    // токен уже создан, но лог не записался — не критично
    return NextResponse.json({ ok: true, token, expiresAt, warn: "event_log_failed" });
  }

  return NextResponse.json({ ok: true, token, expiresAt });
}
