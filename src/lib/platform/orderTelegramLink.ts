/**
 * Linking a PAID ORDER to a Telegram chat, with no sign-in in between.
 *
 * Why this exists (owner, 2026-10-14, the post-purchase proposal of 03.10):
 * reminders and the «старт завтра» message reach a learner only through
 * `customers.tg_id`, and the only way to fill it was the cabinet link — after a
 * sign-in most buyers had not done yet. A group buyer who never opened the
 * course heard nothing until the stream was half over. The moment a person is
 * most willing to tap «Start» is right after paying, so the link is offered
 * there and in the receipt, and it names the ORDER: the bot finds the buyer
 * through it, whoever is or is not signed in.
 *
 * Signed, not stored — the same reasoning and the same secret as
 * `telegramLink.ts`. The prefix's third character, `o`, is neither a hex digit
 * (the account token) nor `q` (the dosha result), so the bot's readers can never
 * mistake one payload for another. The window is long because the receipt
 * carries the link, and a letter is read days later.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

import { SUPPORT_BOT_URL } from "@/lib/supportBotUrl";

const PREFIX = "cwo";
const TTL_MS = 30 * 24 * 60 * 60 * 1000;
const SIGNATURE_CHARS = 16;

function secret(): string {
  const value = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!value) throw new Error("telegram_link_secret_missing");
  return value;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("hex").slice(0, SIGNATURE_CHARS);
}

/** `cwo<order uuid without dashes><base36 expiry><signature>` — 64 chars at most. */
export function createOrderTelegramToken(orderId: string, now = Date.now()): string {
  const compactId = orderId.replace(/-/g, "");
  const expiresAt = (now + TTL_MS).toString(36);
  return `${PREFIX}${compactId}${expiresAt}${sign(`${compactId}.${expiresAt}`)}`;
}

/** The deep link the buyer taps; null when the secret is missing, so no dead button is drawn. */
export function orderTelegramUrl(orderId: string, now = Date.now()): string | null {
  try {
    return `${SUPPORT_BOT_URL}?start=${createOrderTelegramToken(orderId, now)}`;
  } catch {
    return null;
  }
}

export type OrderTelegramVerdict =
  { ok: true; orderId: string } | { ok: false; reason: "malformed" | "expired" | "bad_signature" };

export function verifyOrderTelegramToken(token: string, now = Date.now()): OrderTelegramVerdict {
  if (!token.startsWith(PREFIX)) return { ok: false, reason: "malformed" };

  const rest = token.slice(PREFIX.length);
  const compactId = rest.slice(0, 32);
  const signature = rest.slice(-SIGNATURE_CHARS);
  const expiryPart = rest.slice(32, rest.length - SIGNATURE_CHARS);

  if (compactId.length !== 32 || !/^[0-9a-f]{32}$/.test(compactId)) {
    return { ok: false, reason: "malformed" };
  }
  if (!expiryPart || !/^[0-9a-z]+$/.test(expiryPart)) return { ok: false, reason: "malformed" };
  if (signature.length !== SIGNATURE_CHARS) return { ok: false, reason: "malformed" };

  const given = Buffer.from(signature);
  const want = Buffer.from(sign(`${compactId}.${expiryPart}`));
  if (given.length !== want.length || !timingSafeEqual(given, want)) {
    return { ok: false, reason: "bad_signature" };
  }

  // After the signature, as in `telegramLink.ts`: nothing is learned by varying
  // the expiry of a token one cannot sign.
  const expiresAt = Number.parseInt(expiryPart, 36);
  if (!Number.isFinite(expiresAt) || expiresAt < now) return { ok: false, reason: "expired" };

  const orderId = [
    compactId.slice(0, 8),
    compactId.slice(8, 12),
    compactId.slice(12, 16),
    compactId.slice(16, 20),
    compactId.slice(20),
  ].join("-");

  return { ok: true, orderId };
}
