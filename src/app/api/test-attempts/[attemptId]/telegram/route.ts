/**
 * POST /api/test-attempts/:id/telegram — the deep link that sends this result
 * to a Telegram chat.
 *
 * Deliberately open to anonymous callers: the whole point of the step is that
 * it comes BEFORE an account. Holding the attempt id is the credential, the
 * token it issues is signed and expires within the hour, and only a finished
 * attempt has anything to send.
 */

import { NextRequest, NextResponse } from "next/server";

import { adminClient } from "@/lib/auth/adminClient";
import { loadTestAttempt } from "@/lib/doshaTestRepo";
import { createDoshaResultToken } from "@/lib/platform/doshaTelegramLink";
import { enforceRateLimit, tooManyRequests } from "@/lib/rateLimit";
import { callTelegramBotApi } from "@/lib/tg";

export const runtime = "nodejs";

/** Resolved from the bot token itself, so this needs no extra configuration. */
let cachedBotUsername: string | null = null;

async function botUsername(): Promise<string | null> {
  if (cachedBotUsername) return cachedBotUsername;
  try {
    const me = await callTelegramBotApi<{ username?: string }>("getMe", {});
    cachedBotUsername = me?.username ?? null;
  } catch {
    cachedBotUsername = null;
  }
  return cachedBotUsername;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ attemptId: string }> }
) {
  const rl = await enforceRateLimit(req, { name: "test_telegram_link", limit: 20, windowSeconds: 60 });
  if (!rl.allowed) return tooManyRequests(rl.retryAfter);

  const { attemptId } = await params;

  try {
    const db = adminClient();
    const attempt = await loadTestAttempt(db, attemptId);
    if (!attempt) {
      return NextResponse.json({ error: "attempt_not_found" }, { status: 404 });
    }
    if (!attempt.result_type) {
      return NextResponse.json({ error: "attempt_not_completed" }, { status: 409 });
    }

    const username = await botUsername();
    if (!username) {
      // Report honestly rather than handing back a link that cannot work.
      return NextResponse.json({ linkUrl: null }, { status: 200 });
    }

    let token: string;
    try {
      token = createDoshaResultToken(attempt.id);
    } catch {
      return NextResponse.json({ linkUrl: null }, { status: 200 });
    }

    return NextResponse.json({ linkUrl: `https://t.me/${username}?start=${token}` });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
