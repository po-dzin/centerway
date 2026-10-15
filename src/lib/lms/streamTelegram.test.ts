import { beforeEach, describe, expect, it, vi } from "vitest";

import { FakeSupabase } from "@/lib/admin/fakeSupabase";
import type { StreamRecipient } from "@/lib/email/lifecycleRuns";

const db = new FakeSupabase();
const chats: { chat: string; html: string }[] = [];

vi.mock("@/lib/auth/adminClient", () => ({ adminClient: () => db }));
vi.mock("@/lib/telegram/tg", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/telegram/tg")>()),
  sendTelegramCard: async (chat: string, card: { html: string }) => {
    chats.push({ chat, html: card.html });
  },
}));

const { buildStreamTelegram, runStreamTelegram, streamTelegramAudience } = await import("./streamTelegram");

const person = (over: Partial<StreamRecipient>): StreamRecipient => ({
  email: "a@example.com",
  name: null,
  programTitle: "Шлях 21",
  startsOn: "2026-11-01",
  tgId: "100",
  enrolled: false,
  streamChat: false,
  chatLink: null,
  ...over,
});

describe("stream messages in Telegram", () => {
  it("goes only to people with a linked chat", () => {
    const people = [person({ tgId: null }), person({ email: "b@example.com" })];
    expect(streamTelegramAudience(people, "tomorrow").map((p) => p.email)).toEqual(["b@example.com"]);
  });

  it("leaves day one of an opened course to the daily «День 1»", () => {
    const people = [person({ enrolled: true }), person({ email: "b@example.com" })];
    expect(streamTelegramAudience(people, "day1").map((p) => p.email)).toEqual(["b@example.com"]);
    expect(streamTelegramAudience(people, "tomorrow")).toHaveLength(2);
  });

  it("names the date the day before, and the first lesson on the day", () => {
    const base = {
      programTitle: "Шлях 21",
      startsOn: "2026-11-01",
      cabinetUrl: "https://my.example/",
      streamChatUrl: null,
    };
    const tomorrow = buildStreamTelegram({ ...base, stage: "tomorrow" });
    expect(tomorrow.html).toContain("<b>Завтра старт · Шлях 21</b>");
    expect(tomorrow.html).toContain("Завтра, 1 листопада, починається потік «Шлях 21».");
    expect(tomorrow.replyMarkup.inline_keyboard).toEqual([[{ text: "Відкрити кабінет", url: "https://my.example/" }]]);

    const day1 = buildStreamTelegram({ ...base, stage: "day1", streamChatUrl: "https://t.me/+chat" });
    expect(day1.html).toContain("<b>День 1 · Шлях 21</b>");
    expect(day1.replyMarkup.inline_keyboard[1]).toEqual([{ text: "Чат потоку", url: "https://t.me/+chat" }]);

    // A picked group: the bot makes a personal link on tap; the shared one is never sent.
    const picked = buildStreamTelegram({
      ...base,
      stage: "day1",
      streamChat: true,
      streamChatUrl: "https://t.me/+chat",
    });
    expect(picked.replyMarkup.inline_keyboard[1]).toEqual([{ text: "Чат потоку", callback_data: "streamchat" }]);
  });

  it("escapes the program title", () => {
    const { html } = buildStreamTelegram({
      stage: "tomorrow",
      programTitle: "A <b>&",
      startsOn: "2026-11-01",
      cabinetUrl: "https://my.example/",
      streamChatUrl: null,
    });
    expect(html).toContain("A &lt;b&gt;&amp;");
  });

  describe("the morning run", () => {
    beforeEach(() => {
      chats.length = 0;
      db.tables.experience_offers = [
        {
          id: "o-group",
          code: "way21-group",
          format: "group",
          cohort_starts_on: "2026-11-01",
          experience_id: "x",
          label: null,
        },
      ];
      db.tables.experiences = [{ id: "x", title: "Шлях 21" }];
      db.tables.orders = [
        { order_ref: "a", status: "paid", offer_id: "o-group", customer_id: "c-chat" },
        { order_ref: "b", status: "paid", offer_id: "o-group", customer_id: "c-mail" },
        { order_ref: "c", status: "paid", offer_id: "o-group", customer_id: "c-open" },
      ];
      db.tables.customers = [
        { id: "c-chat", email: "chat@x.com", display_name: null, tg_id: "111", auth_user_id: null },
        { id: "c-mail", email: "mail@x.com", display_name: null, tg_id: null, auth_user_id: null },
        { id: "c-open", email: "open@x.com", display_name: null, tg_id: "333", auth_user_id: "u-open" },
      ];
      db.tables.lms_enrollments = [
        { auth_user_id: "u-open", course_id: "k", cohort_starts_on: "2026-11-01", status: "active", revoked_at: null },
      ];
      db.tables.platform_users = [{ auth_user_id: "u-open", email: "open@x.com", full_name: null }];
      db.tables.lms_courses = [{ id: "k", title: "Шлях 21" }];
      db.tables.events = [];
    });

    it("writes «завтра» to every linked chat, once", async () => {
      const run = await runStreamTelegram(new Date("2026-10-31T06:00:00.000Z"));
      expect(run.tomorrow).toEqual({ candidates: 2, sent: 2, skipped: 0, failed: 0 });
      expect(chats.map((c) => c.chat).sort()).toEqual(["111", "333"]);

      const again = await runStreamTelegram(new Date("2026-10-31T06:05:00.000Z"));
      expect(again.tomorrow.sent).toBe(0);
      expect(chats).toHaveLength(2);
    });

    it("on day one, writes only to the buyer who has not opened the course", async () => {
      const run = await runStreamTelegram(new Date("2026-11-01T06:00:00.000Z"));
      expect(run.day1.sent).toBe(1);
      expect(chats).toEqual([expect.objectContaining({ chat: "111" })]);
      expect(chats[0]?.html).toContain("День 1 · Шлях 21");
    });
  });
});
