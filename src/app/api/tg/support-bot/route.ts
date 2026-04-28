import { NextRequest, NextResponse } from "next/server";
import {
  handleTgSupportBotUpdate,
  type TelegramUpdate,
} from "@/lib/tgSupportBot";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json(
      { ok: false, error: "missing_webhook_secret" },
      { status: 500 }
    );
  }

  if (req.headers.get("x-telegram-bot-api-secret-token") !== secret) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const update = (await req.json().catch(() => null)) as TelegramUpdate | null;
  if (!update || typeof update.update_id !== "number") {
    return NextResponse.json({ ok: false, error: "bad_update" }, { status: 400 });
  }

  try {
    await handleTgSupportBotUpdate(update);
  } catch {
    return NextResponse.json({ ok: true, handled: false });
  }

  return NextResponse.json({ ok: true });
}

export async function GET() {
  return NextResponse.json({ ok: false, error: "method_not_allowed" }, { status: 405 });
}
