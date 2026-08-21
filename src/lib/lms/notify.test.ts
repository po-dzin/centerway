import { beforeEach, describe, expect, it, vi } from "vitest";

const sent: Array<{ chatId: number | string; text: string }> = [];

vi.mock("@/lib/tg", () => ({
  sendTelegramMessage: async (chatId: number | string, text: string) => {
    sent.push({ chatId, text });
  },
}));

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
            table === "platform_users"
              ? { data: { notification_channels: ["telegram"] } }
              : { data: { tg_id: "555" } },
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
    expect(sent[0].text).toContain("https://www.centerway.net.ua/learn/way21/day-3");
    expect(sent[0].text).not.toMatch(/\n\/learn/);
  });

  it("leaves an already-absolute link alone", async () => {
    await notifyLearner({ authUserId: "user-1", text: "Тест", href: "https://example.com/x" });
    expect(sent[0].text).toContain("https://example.com/x");
    expect(sent[0].text).not.toContain("centerway.net.ua/https");
  });

  it("sends the body unchanged when there is no link", async () => {
    await notifyLearner({ authUserId: "user-1", text: "Без посилання" });
    expect(sent[0].text).toBe("Без посилання");
  });

  it("addresses the chat id resolved from the profile", async () => {
    await notifyLearner({ authUserId: "user-1", text: "Тест" });
    expect(sent[0].chatId).toBe("555");
  });
});
