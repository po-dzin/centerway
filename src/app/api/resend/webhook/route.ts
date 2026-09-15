import { NextRequest, NextResponse } from "next/server";

import { applyResendEvent } from "@/lib/broadcasts/subscriptions";
import { parseResendEvent, verifyResendWebhook } from "@/lib/email/resendWebhook";
import { log } from "@/lib/logger";

/**
 * Resend → us: delivered, opened, clicked, bounced, complained.
 *
 * Configure in the Resend dashboard (Webhooks → this URL, those five events) and
 * put its signing secret in RESEND_WEBHOOK_SECRET. Without the secret every
 * event is refused — an unsigned endpoint that suppresses addresses would let
 * anyone empty the list.
 *
 * A 5xx makes Resend retry; a signature failure is a 401 and is not retried.
 * Events for messages that are not broadcasts are acknowledged and ignored.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    log.error("resend_webhook.secret_missing", {});
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  const rawBody = await req.text();
  const valid = verifyResendWebhook({
    rawBody,
    secret,
    headers: {
      id: req.headers.get("svix-id"),
      timestamp: req.headers.get("svix-timestamp"),
      signature: req.headers.get("svix-signature"),
    },
  });
  if (!valid) return NextResponse.json({ error: "invalid_signature" }, { status: 401 });

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const event = parseResendEvent(parsed);
  if (!event) return NextResponse.json({ ok: true, outcome: "ignored" });

  try {
    const outcome = await applyResendEvent(event);
    return NextResponse.json({ ok: true, outcome });
  } catch (error) {
    log.error("resend_webhook.apply_failed", {
      type: event.type,
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "apply_failed" }, { status: 500 });
  }
}
