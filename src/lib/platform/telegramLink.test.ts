import { beforeAll, describe, expect, it } from "vitest";

import { createTelegramLinkToken, verifyTelegramLinkToken } from "./telegramLink";

const USER_ID = "bdc98ead-08d6-4869-ae09-cd154030e339";

describe("telegram link token", () => {
  beforeAll(() => {
    process.env.TELEGRAM_WEBHOOK_SECRET = "test-secret-for-link-tokens";
  });

  it("round-trips the account id", () => {
    const token = createTelegramLinkToken(USER_ID);
    expect(verifyTelegramLinkToken(token)).toEqual({ ok: true, authUserId: USER_ID });
  });

  it("fits Telegram's 64-character start payload limit", () => {
    const token = createTelegramLinkToken(USER_ID);
    expect(token.length).toBeLessThanOrEqual(64);
    // Telegram only accepts [A-Za-z0-9_-] in a start payload.
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("rejects a tampered account id", () => {
    const token = createTelegramLinkToken(USER_ID);
    const forged = `cw${"f".repeat(32)}${token.slice(34)}`;
    expect(verifyTelegramLinkToken(forged)).toEqual({ ok: false, reason: "bad_signature" });
  });

  it("rejects a token past its expiry", () => {
    const issuedAt = Date.parse("2026-08-17T10:00:00Z");
    const token = createTelegramLinkToken(USER_ID, issuedAt);
    // 16 minutes later — one past the 15-minute window.
    expect(verifyTelegramLinkToken(token, issuedAt + 16 * 60 * 1000)).toEqual({
      ok: false,
      reason: "expired",
    });
  });

  it("reports a foreign payload as malformed so other deep links still work", () => {
    // The product bots use their own payloads; the support bot must fall
    // through to its normal flow rather than claim them.
    expect(verifyTelegramLinkToken("ZGw6MjA1MTY4").ok).toBe(false);
    expect(verifyTelegramLinkToken("ZGw6MjA1MTY4")).toEqual({ ok: false, reason: "malformed" });
  });

  it("does not accept a token signed with a different secret", () => {
    const token = createTelegramLinkToken(USER_ID);
    process.env.TELEGRAM_WEBHOOK_SECRET = "a-different-secret";
    expect(verifyTelegramLinkToken(token)).toEqual({ ok: false, reason: "bad_signature" });
    process.env.TELEGRAM_WEBHOOK_SECRET = "test-secret-for-link-tokens";
  });
});
