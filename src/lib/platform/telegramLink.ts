/**
 * Linking a platform account to a Telegram chat.
 *
 * Why this exists: reminders are addressed to a learner and resolved to a
 * channel via `customers.tg_id` (src/lib/lms/notify.ts). Nothing in the product
 * ever wrote that column except an admin editing a customer by hand — so for
 * practically every learner the reminder pipeline resolved zero channels and
 * went silently undelivered. This is the missing self-service half.
 *
 * The token is SIGNED, not stored. A tokens table would need a migration, a TTL
 * sweep and a cleanup job to express something that is already fully contained
 * in the token itself: "this account, until this instant". Replay inside the
 * short window links the same account to the same chat, which is the intended
 * outcome anyway, so single-use adds no protection worth that machinery.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

/** Telegram caps the `start` payload at 64 chars from [A-Za-z0-9_-]. */
const PREFIX = "cw";
const TTL_MS = 15 * 60 * 1000;
const SIGNATURE_CHARS = 16;

function secret(): string {
  // Reuses the webhook secret rather than adding config: both authenticate the
  // same trust boundary (this server ↔ this bot), and a link token is useless
  // to anyone who cannot also reach the webhook.
  const value = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!value) throw new Error("telegram_link_secret_missing");
  return value;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("hex").slice(0, SIGNATURE_CHARS);
}

/**
 * Builds the `start` payload binding an account to a link request.
 * Format: `cw<uuid-without-dashes><base36 expiry><signature>`.
 */
export function createTelegramLinkToken(authUserId: string, now = Date.now()): string {
  const compactId = authUserId.replace(/-/g, "");
  const expiresAt = (now + TTL_MS).toString(36);
  const body = `${compactId}.${expiresAt}`;
  return `${PREFIX}${compactId}${expiresAt}${sign(body)}`;
}

export type TelegramLinkVerdict =
  | { ok: true; authUserId: string }
  | { ok: false; reason: "malformed" | "expired" | "bad_signature" };

/** Reverses `createTelegramLinkToken`, refusing anything it did not issue. */
export function verifyTelegramLinkToken(token: string, now = Date.now()): TelegramLinkVerdict {
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

  const expected = sign(`${compactId}.${expiryPart}`);
  const given = Buffer.from(signature);
  const want = Buffer.from(expected);
  if (given.length !== want.length || !timingSafeEqual(given, want)) {
    return { ok: false, reason: "bad_signature" };
  }

  // Expiry is checked AFTER the signature: an attacker must not be able to
  // learn anything by varying the expiry of a token they cannot sign.
  const expiresAt = Number.parseInt(expiryPart, 36);
  if (!Number.isFinite(expiresAt) || expiresAt < now) return { ok: false, reason: "expired" };

  const authUserId = [
    compactId.slice(0, 8),
    compactId.slice(8, 12),
    compactId.slice(12, 16),
    compactId.slice(16, 20),
    compactId.slice(20),
  ].join("-");

  return { ok: true, authUserId };
}
