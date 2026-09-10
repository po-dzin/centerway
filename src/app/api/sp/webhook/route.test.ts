/**
 * The SendPulse chatbot webhook: a shared secret, a best-effort event row,
 * and one Telegram message to the support thread. What matters here is the
 * gate (a wrong secret must be a 401, a missing one a 503), the quiet cases
 * (no chat configured, or a flow that fired with nothing in it must answer
 * 200 so SendPulse does not retry forever), and that a Telegram failure never
 * surfaces to SendPulse.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { FakeSupabase } from "@/lib/admin/fakeSupabase";

const db = new FakeSupabase();
const sendTelegramMessage = vi.fn<(chatId: string, text: string, opts?: { messageThreadId?: number | null }) => Promise<void>>(async () => undefined);

vi.mock("@/lib/auth/adminClient", () => ({ adminClient: () => db }));
vi.mock("@/lib/telegram/tg", () => ({ sendTelegramMessage }));

const { POST, GET } = await import("./route");

const SECRET = "sp-test-secret";

function post(body: unknown, opts: { secret?: string | null; viaQuery?: boolean } = {}) {
  const secret = opts.secret === undefined ? SECRET : opts.secret;
  const url = new URL("https://www.centerway.net.ua/api/sp/webhook");
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (secret !== null) {
    if (opts.viaQuery) url.searchParams.set("secret", secret);
    else headers["x-sp-secret"] = secret;
  }
  return POST(new NextRequest(url, { method: "POST", headers, body: typeof body === "string" ? body : JSON.stringify(body) }));
}

const settle = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  process.env.SP_WEBHOOK_SECRET = SECRET;
  process.env.SUPPORT_CHAT_ID = "1001234567890";
  process.env.SUPPORT_THREAD_ID = "42";
  db.tables = { events: [] };
  sendTelegramMessage.mockClear();
  sendTelegramMessage.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("POST /api/sp/webhook", () => {
  it("answers 503 when the secret is not configured, before reading the body", async () => {
    delete process.env.SP_WEBHOOK_SECRET;
    const res = await post({ contact: { name: "Оля" }, message: "Привіт" });
    expect(res.status).toBe(503);
    expect(sendTelegramMessage).not.toHaveBeenCalled();
  });

  it("refuses a wrong or absent secret with 401 and writes nothing", async () => {
    expect((await post({ message: "x" }, { secret: "nope" })).status).toBe(401);
    expect((await post({ message: "x" }, { secret: null })).status).toBe(401);
    await settle();
    expect(db.tables.events).toHaveLength(0);
    expect(sendTelegramMessage).not.toHaveBeenCalled();
  });

  it("accepts the secret from the query string as well as the header", async () => {
    const res = await post({ contact: { name: "Оля" }, message: "Привіт" }, { viaQuery: true });
    expect(res.status).toBe(200);
    expect(sendTelegramMessage).toHaveBeenCalledTimes(1);
  });

  it("answers 400 to a body that is not JSON", async () => {
    const res = await post("not json");
    expect(res.status).toBe(400);
  });

  it("forwards a course question to the support thread, with the contact block first and the text last", async () => {
    const res = await post({
      contact: { id: "c1", name: "Оля", last_name: "Петренко", username: "@olya", source: "telegram", email: "olya@example.com" },
      variables: { Course_question: "Чи є доступ назавжди?" },
      bot: { id: "b1", name: "CW bot" },
      flow: { id: "f1", name: "FAQ" },
    });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true, forwarded: true });

    expect(sendTelegramMessage).toHaveBeenCalledTimes(1);
    const [chatId, text, opts] = sendTelegramMessage.mock.calls[0];
    expect(chatId).toBe("1001234567890");
    expect(opts).toEqual({ messageThreadId: 42 });
    const lines = text.split("\n");
    expect(lines[0]).toBe("❓ SP: Питання по курсу");
    expect(lines).toContain("Ім'я: Оля Петренко");
    expect(lines).toContain("Юзернейм: @olya");
    expect(lines).toContain("Email: olya@example.com");
    expect(lines).toContain("Бот: CW bot");
    expect(lines[lines.length - 1]).toBe("Чи є доступ назавжди?");

    await settle();
    expect(db.tables.events).toHaveLength(1);
    expect(db.tables.events[0]).toMatchObject({ type: "sp_chatbot_webhook", payload: { contact_id: "c1", bot_id: "b1", flow_id: "f1" } });
  });

  it("treats a free-text message with no named variable as a support request", async () => {
    await post({ contact: { name: "Іван" }, message: { type: "text", text: "Не приходить лист" } });
    const text = sendTelegramMessage.mock.calls[0][1];
    expect(text.startsWith("🆘 SP: Звернення")).toBe(true);
    expect(text.endsWith("Не приходить лист")).toBe(true);
  });

  it("acknowledges an empty fire without forwarding: unresolved {{placeholders}} are not content", async () => {
    const res = await post({ contact: { name: "Оля" }, variables: { Course_question: "{{Course_question}}", Feedback_full: "" } });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true, forwarded: false, reason: "empty" });
    expect(sendTelegramMessage).not.toHaveBeenCalled();
    await settle();
    expect(db.tables.events).toHaveLength(1);
  });

  it("still answers 200 when no support chat is configured, so SendPulse does not retry", async () => {
    delete process.env.SUPPORT_CHAT_ID;
    const res = await post({ message: "Привіт" });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true, forwarded: false });
    expect(sendTelegramMessage).not.toHaveBeenCalled();
  });

  it("swallows a Telegram failure: SendPulse gets a 200 either way", async () => {
    sendTelegramMessage.mockRejectedValueOnce(new Error("Telegram sendMessage failed: 429"));
    const res = await post({ message: "Привіт" });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true, forwarded: false });
  });

  it("does not accept GET", async () => {
    expect((await GET()).status).toBe(405);
  });
});
