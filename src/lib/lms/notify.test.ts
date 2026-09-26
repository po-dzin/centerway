import { beforeEach, describe, expect, it, vi } from "vitest";

type Card = {
  html: string;
  photo?: string | null;
  replyMarkup?: { inline_keyboard: Array<Array<{ text: string; url?: string }>> };
};
const sent: Array<{ chatId: number | string; text: string; card: Card }> = [];

vi.mock("@/lib/telegram/tg", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/telegram/tg")>();
  return {
    escapeTelegramHtml: actual.escapeTelegramHtml,
    sendTelegramCard: async (chatId: number | string, card: Card) => {
      sent.push({ chatId, text: card.html, card });
    },
  };
});

const buttonUrl = (index = 0) => sent[index]!.card.replyMarkup?.inline_keyboard[0]?.[0]?.url;

/**
 * Minimal stand-in for the two profile reads `resolveChannels` makes.
 * `platform_users` supplies the preferred channels, `customers` the address.
 */
vi.mock("@/lib/auth/adminClient", () => ({
  adminClient: () => ({
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () =>
            table === "platform_users" ? { data: { notification_channels: ["telegram"] } } : { data: { tg_id: "555" } },
        }),
      }),
    }),
  }),
}));

const { notifyLearner } = await import("./notify");

describe("learner notifications", () => {
  beforeEach(() => {
    sent.length = 0;
  });

  /**
   * The bug this covers shipped and would have gone unnoticed: every reminder
   * we queue carries a site-relative href, and Telegram does not linkify
   * "/learn/way21" — it prints it. The nudge arrives as a path to retype.
   */
  it("sends an absolute URL, not the site-relative path it was given", async () => {
    const result = await notifyLearner({
      authUserId: "user-1",
      text: "День 3: Підготовка",
      href: "/learn/way21/day-3",
    });

    expect(result).toEqual({ delivered: true, channel: "telegram" });
    expect(sent).toHaveLength(1);
    // The PERSONAL origin: lessons live on `my`, and a reminder that named
    // `www` would spend a 308 on the way to the lesson it points at.
    expect(buttonUrl()).toBe("https://my.centerway.net.ua/way21/day-3");
    // The link rides on the button, not as a bare URL at the foot of the body.
    expect(sent[0]!.text).not.toContain("http");
  });

  it("leaves an already-absolute link alone", async () => {
    await notifyLearner({ authUserId: "user-1", text: "Тест", href: "https://example.com/x" });
    expect(buttonUrl()).toBe("https://example.com/x");
  });

  it("sends the body unchanged when there is no link", async () => {
    await notifyLearner({ authUserId: "user-1", text: "Без посилання" });
    expect(sent[0]!.text).toBe("Без посилання");
    expect(sent[0]!.card.replyMarkup).toBeUndefined();
  });

  it("escapes what it did not write, and bolds the title", async () => {
    await notifyLearner({ authUserId: "user-1", title: "Курс <A&B>", text: "1 < 2", href: "/learn/x" });
    expect(sent[0]!.text).toBe("<b>Курс &lt;A&amp;B&gt;</b>\n\n1 &lt; 2");
  });

  it("absolutises a site-relative cover for Telegram to fetch", async () => {
    await notifyLearner({ authUserId: "user-1", text: "Тест", imageSrc: "/cw/cover.png" });
    expect(sent[0]!.card.photo).toBe("https://www.centerway.net.ua/cw/cover.png");
  });

  it("addresses the chat id resolved from the profile", async () => {
    await notifyLearner({ authUserId: "user-1", text: "Тест" });
    expect(sent[0]!.chatId).toBe("555");
  });
});
