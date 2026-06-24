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

// Known SP flow variables captured via "Ввод данных" steps.
// Order defines display priority; each maps to a labeled section.
const KNOWN_VARIABLES: Array<{ keys: string[]; icon: string; label: string }> = [
  { keys: ["Course_question", "course_question", "question"], icon: "❓", label: "Питання по курсу" },
  { keys: ["Feedback_full", "feedback_full", "feedback"], icon: "⭐", label: "Відгук" },
  { keys: ["Promo_request", "promo_request", "promo"], icon: "💸", label: "Запит на промо/знижку" },
];

// SP "Ввод данных" leaves placeholders unresolved (e.g. "{{Course_question}}")
// when the variable is empty. Treat those as no value.
function resolvedVar(vars: Record<string, string | null> | undefined, keys: string[]): string | null {
  if (!vars) return null;
  for (const k of keys) {
    const raw = str(vars[k]);
    if (raw && !/^\{\{.*\}\}$/.test(raw)) return raw;
  }
  return null;
}

function clamp(text: string, max = 800): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

// True when the call carries an actual question/feedback/promo or a message.
// Prevents forwarding empty SP fires (unresolved placeholders) as noise.
function hasMeaningfulContent(body: SpWebhookBody): boolean {
  const hasVar = KNOWN_VARIABLES.some((v) => resolvedVar(body.variables, v.keys));
  if (hasVar) return true;
  const messageText =
    typeof body.message === "string"
      ? str(body.message)
      : str(body.message?.text) ?? str(body.last_message) ?? null;
  return Boolean(messageText);
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

  // Named variables (questions / feedback / promo) take priority.
  const captured = KNOWN_VARIABLES
    .map((v) => ({ ...v, value: resolvedVar(body.variables, v.keys) }))
    .filter((v) => v.value);

  const messageText =
    typeof body.message === "string"
      ? str(body.message)
      : str(body.message?.text) ?? str(body.last_message) ?? null;

  // Header reflects the primary captured type, falling back to generic.
  const header = captured.length === 1
    ? `${captured[0].icon} SP: ${captured[0].label}`
    : "📩 SP Чатбот";

  const lines: string[] = [header];

  lines.push(`Ім'я: ${fullName}`);
  if (username) lines.push(`Юзернейм: @${username.replace(/^@/, "")}`);
  lines.push(`Канал: ${source}`);
  if (email) lines.push(`Email: ${email}`);
  if (phone) lines.push(`Тел: ${phone}`);

  for (const v of captured) {
    lines.push("");
    lines.push(`${v.icon} ${v.label}:`);
    lines.push(clamp(v.value as string));
  }

  // Generic message only when no named variable was captured.
  if (captured.length === 0 && messageText) {
    lines.push("");
    lines.push(clamp(messageText));
  }

  const botName = str(body.bot?.name);
  const flowName = str(body.flow?.name);
  const event = str(body.event);
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

  if (!hasMeaningfulContent(body)) {
    // Empty fire (unresolved placeholders / no message) — ack without noise
    return NextResponse.json({ ok: true, forwarded: false, reason: "empty" });
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
