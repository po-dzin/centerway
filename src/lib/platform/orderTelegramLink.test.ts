import { beforeAll, describe, expect, it } from "vitest";
import { createDoshaResultToken, verifyDoshaResultToken } from "./doshaTelegramLink";
import { createOrderTelegramToken, orderTelegramUrl, verifyOrderTelegramToken } from "./orderTelegramLink";
import { createTelegramLinkToken, verifyTelegramLinkToken } from "./telegramLink";

const ORDER = "8a1b2c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d";
const DAY = 24 * 60 * 60 * 1000;

beforeAll(() => {
  process.env.TELEGRAM_WEBHOOK_SECRET = "test-secret";
});

describe("order telegram token", () => {
  it("round-trips the order it was issued for", () => {
    expect(verifyOrderTelegramToken(createOrderTelegramToken(ORDER))).toEqual({ ok: true, orderId: ORDER });
  });

  it("fits inside Telegram's 64-character start payload", () => {
    const token = createOrderTelegramToken(ORDER);
    expect(token.length).toBeLessThanOrEqual(64);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("lives long enough to be tapped from the receipt, and no longer", () => {
    const issued = createOrderTelegramToken(ORDER, 0);
    expect(verifyOrderTelegramToken(issued, 29 * DAY).ok).toBe(true);
    expect(verifyOrderTelegramToken(issued, 31 * DAY)).toEqual({ ok: false, reason: "expired" });
  });

  it("refuses a token it did not sign", () => {
    const token = createOrderTelegramToken(ORDER);
    const tampered = `${token.slice(0, -1)}${token.endsWith("a") ? "b" : "a"}`;
    expect(verifyOrderTelegramToken(tampered)).toEqual({ ok: false, reason: "bad_signature" });
  });

  it("is never read as an account or a dosha token, nor reads theirs", () => {
    const order = createOrderTelegramToken(ORDER);
    expect(verifyTelegramLinkToken(order)).toEqual({ ok: false, reason: "malformed" });
    expect(verifyDoshaResultToken(order)).toEqual({ ok: false, reason: "malformed" });
    expect(verifyOrderTelegramToken(createTelegramLinkToken(ORDER))).toEqual({ ok: false, reason: "malformed" });
    expect(verifyOrderTelegramToken(createDoshaResultToken(ORDER))).toEqual({ ok: false, reason: "malformed" });
  });

  it("builds the bot's deep link, and none without a secret", () => {
    expect(orderTelegramUrl(ORDER)).toMatch(/^https:\/\/telegram\.me\/centerway_support_bot\?start=cwo[0-9a-f]{32}/);
    const saved = process.env.TELEGRAM_WEBHOOK_SECRET;
    delete process.env.TELEGRAM_WEBHOOK_SECRET;
    try {
      expect(orderTelegramUrl(ORDER)).toBeNull();
    } finally {
      process.env.TELEGRAM_WEBHOOK_SECRET = saved;
    }
  });
});
