/**
 * Sending a test result to a Telegram chat.
 *
 * Why a token and not the attempt id: the deep link is a URL the reader may
 * paste anywhere, and a raw id would let whoever finds it pull a stranger's
 * profile out of the bot. The token is signed and short-lived, so a link that
 * escapes stops working long before it can be traded.
 *
 * Signed, not stored — same reasoning as `telegramLink.ts`, and the same
 * secret: both authenticate this server to this bot. The prefix differs, and
 * its third character is deliberately not a hex digit, so an account token and
 * an attempt token can never be mistaken for one another.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

const PREFIX = "cwq";
const TTL_MS = 60 * 60 * 1000;
const SIGNATURE_CHARS = 16;

function secret(): string {
  const value = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!value) throw new Error("telegram_link_secret_missing");
  return value;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("hex").slice(0, SIGNATURE_CHARS);
}

/** `cwq<uuid-without-dashes><base36 expiry><signature>` — 64 chars at most. */
export function createDoshaResultToken(attemptId: string, now = Date.now()): string {
  const compactId = attemptId.replace(/-/g, "");
  const expiresAt = (now + TTL_MS).toString(36);
  return `${PREFIX}${compactId}${expiresAt}${sign(`${compactId}.${expiresAt}`)}`;
}

export type DoshaResultTokenVerdict =
  | { ok: true; attemptId: string }
  | { ok: false; reason: "malformed" | "expired" | "bad_signature" };

export function verifyDoshaResultToken(token: string, now = Date.now()): DoshaResultTokenVerdict {
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

  const expiresAt = Number.parseInt(expiryPart, 36);
  if (!Number.isFinite(expiresAt) || expiresAt < now) return { ok: false, reason: "expired" };

  const attemptId = [
    compactId.slice(0, 8),
    compactId.slice(8, 12),
    compactId.slice(12, 16),
    compactId.slice(16, 20),
    compactId.slice(20),
  ].join("-");

  return { ok: true, attemptId };
}
