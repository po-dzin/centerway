import { NextRequest, NextResponse } from "next/server";

import { secretsEqual } from "@/lib/auth/secretsEqual";
import { handleComment, handlePostback } from "@/lib/autoreply/engine";
import {
  instagramSenderFromEnv,
  parseCommentEvents,
  parsePostbackEvents,
  verifySignature,
} from "@/lib/autoreply/instagram";
import { dbStore } from "@/lib/autoreply/store";
import { log } from "@/lib/logger";
import { PLATFORM_ORIGIN } from "@/lib/surfaces/catalog";

export const runtime = "nodejs";

function appSecret(): string | null {
  return process.env.META_APP_SECRET?.trim() || process.env.INSTAGRAM_APP_SECRET?.trim() || null;
}

/**
 * Meta's subscription handshake: it calls once with a challenge when the
 * webhook is added in the app dashboard, and expects the challenge back if the
 * verify token is ours.
 */
export async function GET(req: NextRequest) {
  const expected = process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN?.trim();
  const params = req.nextUrl.searchParams;
  if (!expected) return NextResponse.json({ error: "not_configured" }, { status: 503 });
  if (params.get("hub.mode") !== "subscribe" || !secretsEqual(params.get("hub.verify_token"), expected)) {
    return NextResponse.json({ error: "verify_failed" }, { status: 403 });
  }
  return new NextResponse(params.get("hub.challenge") ?? "", {
    status: 200,
    headers: { "content-type": "text/plain" },
  });
}

/**
 * Comments on the account's posts. Needs the app secret: an unsigned endpoint
 * that sends direct messages in the brand's name would let anyone make the
 * account write to anyone.
 *
 * A 5xx makes Meta deliver again; that is safe because every comment is
 * claimed by its id before anything is sent.
 */
export async function POST(req: NextRequest) {
  const secret = appSecret();
  if (!secret) {
    log.error("instagram.webhook_secret_missing", {});
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  const body = await req.text();
  if (!verifySignature(secret, body, req.headers.get("x-hub-signature-256"))) {
    return NextResponse.json({ error: "signature_invalid" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "body_invalid" }, { status: 400 });
  }

  const events = parseCommentEvents(payload);
  const taps = parsePostbackEvents(payload);
  log.info("instagram.webhook_received", { comments: events.length, taps: taps.length });
  if (events.length === 0 && taps.length === 0) return NextResponse.json({ ok: true, handled: 0 });

  const store = dbStore();
  const sender = instagramSenderFromEnv();
  const results: string[] = [];
  try {
    for (const tap of taps) {
      const result = await handlePostback(tap, { store, sender, siteOrigin: PLATFORM_ORIGIN });
      results.push(`postback_${result.outcome}`);
    }
    for (const event of events) {
      const result = await handleComment(event, { store, sender, siteOrigin: PLATFORM_ORIGIN });
      results.push(result.outcome);
    }
  } catch (error) {
    log.error("instagram.webhook_failed", { message: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "handle_failed" }, { status: 500 });
  }
  log.info("instagram.webhook_handled", { results });
  return NextResponse.json({ ok: true, handled: events.length + taps.length, results });
}
