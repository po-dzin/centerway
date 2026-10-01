import { NextRequest, NextResponse } from "next/server";

import { log } from "@/lib/logger";
import { applyResendEvent, verifySvixSignature, type ResendEvent } from "@/lib/broadcasts/resendWebhook";

/**
 * Resend's delivery events: stats for campaigns, and the suppression list for
 * everything (see resendWebhook.ts).
 *
 * Needs `RESEND_WEBHOOK_SECRET` (the `whsec_…` value shown when the endpoint
 * is added in the Resend dashboard). Without it every call is refused: an
 * unsigned endpoint that writes the suppression list would let anyone take
 * any address off it.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.RESEND_WEBHOOK_SECRET?.trim();
  if (!secret) {
    log.error("resend.webhook_secret_missing", {});
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  const body = await req.text();
  const ok = verifySvixSignature(
    secret,
    {
      id: req.headers.get("svix-id"),
      timestamp: req.headers.get("svix-timestamp"),
      signature: req.headers.get("svix-signature"),
    },
    body,
  );
  if (!ok) return NextResponse.json({ error: "signature_invalid" }, { status: 401 });

  let event: ResendEvent;
  try {
    event = JSON.parse(body) as ResendEvent;
  } catch {
    return NextResponse.json({ error: "body_invalid" }, { status: 400 });
  }

  try {
    const result = await applyResendEvent(event);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    // A 5xx makes Resend retry, which is what an unapplied bounce deserves.
    log.error("resend.webhook_failed", {
      type: event.type ?? null,
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "apply_failed" }, { status: 500 });
  }
}
