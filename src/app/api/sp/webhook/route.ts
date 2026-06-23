import { NextRequest, NextResponse } from "next/server";
import { adminClient } from "@/lib/auth/adminClient";
import { sendTelegramMessage } from "@/lib/tg";

export const runtime = "nodejs";

// SP chatbot "Send Request" action payload shape (SendPulse flow builder)
type SpContact = {
  id?: string;
  name?: string;
  last_name?: string;
  email?: string | null;
  phone?: string | null;
  username?: string | null;
  source?: string;
  telegram_id?: number | null;
};

type SpWebhookBody = {
  contact?: SpContact;
  // Variables captured in the SP flow (e.g. email, phone collected via Ask Question)
  variables?: Record<string, string | null>;
  // Last user message
  message?: { type?: string; text?: string } | string;
  // Flow and bot metadata
  flow?: { id?: string; name?: string };
  bot?: { id?: string; name?: string };
  // Flat fields some SP configs send instead of nested
  contact_name?: string;
  contact_email?: string | null;
  contact_phone?: string | null;
  contact_username?: string | null;
  channel?: string;
  last_message?: string;
  event?: string;
};

function str(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s || null;
}

function formatNotification(body: SpWebhookBody): string {
  const contact = body.contact ?? {};

  const name = str(contact.name) ?? str(body.contact_name) ?? "—";
  const lastName = str(contact.last_name);
  const fullName = lastName ? `${name} ${lastName}` : name;

  const username = str(contact.username) ?? str(body.contact_username);
  const source = str(contact.source) ?? str(body.channel) ?? "sp";

  const email =
    str(contact.email) ??
    str(body.contact_email) ??
    str(body.variables?.["email"]) ??
    null;

  const phone =
    str(contact.phone) ??
    str(body.contact_phone) ??
    str(body.variables?.["phone"]) ??
    null;

  const messageText =
    typeof body.message === "string"
      ? str(body.message)
      : str(body.message?.text) ?? str(body.last_message) ?? null;

  const botName = str(body.bot?.name);
  const flowName = str(body.flow?.name);
  const event = str(body.event);

  const lines: string[] = ["📩 SP Чатбот"];

  lines.push(`Ім'я: ${fullName}`);
  if (username) lines.push(`Юзернейм: @${username.replace(/^@/, "")}`);
  lines.push(`Канал: ${source}`);
  if (email) lines.push(`Email: ${email}`);
  if (phone) lines.push(`Тел: ${phone}`);

  if (messageText) {
    lines.push("");
    lines.push(messageText.length > 500 ? `${messageText.slice(0, 500)}…` : messageText);
  }

  const meta: string[] = [];
  if (botName) meta.push(`Бот: ${botName}`);
  if (flowName) meta.push(`Flow: ${flowName}`);
  if (event) meta.push(`Event: ${event}`);
  if (meta.length) {
    lines.push("");
    lines.push(meta.join(" | "));
  }

  return lines.join("\n");
}

function logEventBestEffort(
  db: ReturnType<typeof adminClient>,
  body: SpWebhookBody
): void {
  const contact = body.contact ?? {};
  void (async () => {
    try {
      await db.from("events").insert({
        type: "sp_chatbot_webhook",
        order_ref: null,
        payload: {
          contact_id: str(contact.id),
          channel: str(contact.source) ?? str(body.channel),
          event: str(body.event),
          bot_id: str(body.bot?.id),
          flow_id: str(body.flow?.id),
        },
      });
    } catch { /* fire-and-forget */ }
  })();
}

export async function POST(req: NextRequest) {
  const secret = process.env.SP_WEBHOOK_SECRET;
  const supportChatId = process.env.SUPPORT_CHAT_ID;

  if (!secret) {
    return NextResponse.json({ ok: false, error: "not_configured" }, { status: 503 });
  }

  // Accept secret via header or query param
  const headerSecret = req.headers.get("x-sp-secret");
  const querySecret = req.nextUrl.searchParams.get("secret");
  if (headerSecret !== secret && querySecret !== secret) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null) as SpWebhookBody | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ ok: false, error: "bad_body" }, { status: 400 });
  }

  const db = adminClient();
  logEventBestEffort(db, body);

  if (!supportChatId) {
    // Secret OK but nowhere to send — still 200 so SP doesn't retry
    return NextResponse.json({ ok: true, forwarded: false });
  }

  try {
    const text = formatNotification(body);
    await sendTelegramMessage(supportChatId, text);
    return NextResponse.json({ ok: true, forwarded: true });
  } catch {
    // Don't surface TG errors to SP
    return NextResponse.json({ ok: true, forwarded: false });
  }
}

export async function GET() {
  return NextResponse.json({ ok: false, error: "method_not_allowed" }, { status: 405 });
}
