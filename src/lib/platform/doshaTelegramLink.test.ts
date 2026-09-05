import { beforeAll, describe, expect, it } from "vitest";
import { createDoshaResultToken, verifyDoshaResultToken } from "./doshaTelegramLink";
import { verifyTelegramLinkToken } from "./telegramLink";

const ATTEMPT = "3f1b2c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d";

beforeAll(() => {
  process.env.TELEGRAM_WEBHOOK_SECRET = "test-secret";
});

describe("dosha result token", () => {
  it("round-trips the attempt it was issued for", () => {
    expect(verifyDoshaResultToken(createDoshaResultToken(ATTEMPT))).toEqual({
      ok: true,
      attemptId: ATTEMPT,
    });
  });

  it("fits inside Telegram's 64-character start payload", () => {
    const token = createDoshaResultToken(ATTEMPT);
    expect(token.length).toBeLessThanOrEqual(64);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("expires", () => {
    const issued = createDoshaResultToken(ATTEMPT, 0);
    expect(verifyDoshaResultToken(issued, 61 * 60 * 1000)).toEqual({ ok: false, reason: "expired" });
  });

  it("refuses a token it did not sign", () => {
    const token = createDoshaResultToken(ATTEMPT);
    const tampered = `${token.slice(0, -1)}${token.endsWith("a") ? "b" : "a"}`;
    expect(verifyDoshaResultToken(tampered).ok).toBe(false);
  });

  it("cannot be mistaken for an account link token, in either direction", () => {
    // The bot tries both readers on the same /start payload.
    expect(verifyTelegramLinkToken(createDoshaResultToken(ATTEMPT))).toEqual({
      ok: false,
      reason: "malformed",
    });
    expect(verifyDoshaResultToken("cw" + "a".repeat(48)).ok).toBe(false);
  });
});
