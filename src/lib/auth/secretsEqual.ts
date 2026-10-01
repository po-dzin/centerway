import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Whether a presented secret is the expected one, compared in constant time.
 *
 * `===` returns at the first differing character, so the time it takes says
 * how much of a guess was right. The webhook signature, the cron bearer and the
 * Telegram and SendPulse webhook secrets were all compared that way
 * (meta-audit 2026-09-30). Both sides are hashed first, so the comparison is
 * always between two buffers of one length and the length of the secret does
 * not leak either.
 */
export function secretsEqual(given: string | null | undefined, expected: string | null | undefined): boolean {
  if (typeof given !== "string" || typeof expected !== "string" || !expected) return false;
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}
