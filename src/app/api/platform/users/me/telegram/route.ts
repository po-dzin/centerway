/**
 * GET /api/platform/users/me/telegram — can we actually reach this learner?
 *
 * Returns the current notification reachability plus, when it is missing, the
 * one-tap deep link that fixes it. The cabinet renders both: telling someone
 * "reminders will not reach you" without handing them the fix is a dead end.
 */

import { NextRequest, NextResponse } from "next/server";

import { adminClient } from "@/lib/auth/adminClient";
import { requireUserFromBearer } from "@/lib/auth/requireUser";
import { createTelegramLinkToken } from "@/lib/platform/telegramLink";
import { callTelegramBotApi } from "@/lib/tg";

export const runtime = "nodejs";

/** Resolved from the bot token itself, so linking needs no extra configuration. */
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

export async function GET(req: NextRequest) {
  const user = await requireUserFromBearer(req.headers.get("authorization"));
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const db = adminClient();
  const { data: customer } = await db
    .from("customers")
    .select("tg_id")
    .eq("auth_user_id", user.id)
    .not("tg_id", "is", null)
    .limit(1)
    .maybeSingle();

  const linked = Boolean(customer?.tg_id);
  if (linked) {
    return NextResponse.json({ linked: true, linkUrl: null });
  }

  const username = await botUsername();
  if (!username) {
    // The bot is unreachable or unconfigured — report honestly rather than
    // handing the learner a link that cannot work.
    return NextResponse.json({ linked: false, linkUrl: null });
  }

  let token: string;
  try {
    token = createTelegramLinkToken(user.id);
  } catch {
    return NextResponse.json({ linked: false, linkUrl: null });
  }

  return NextResponse.json({
    linked: false,
    linkUrl: `https://t.me/${username}?start=${token}`,
  });
}
