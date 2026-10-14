/**
 * WHO IS PAYING, BEYOND AN ADDRESS (owner, 2026-10-14): a name to address the
 * buyer by and one messenger to reach them in — Telegram or WhatsApp. An email
 * can bounce, land in spam or carry a typo; a group program needs a channel a
 * person actually reads.
 *
 * Pure, so the checkout form answers in the buyer's words before a round trip
 * and `/api/pay/start` checks the same rules again as the authority.
 */

export type ContactChannel = "telegram" | "whatsapp";

export const CONTACT_CHANNELS: readonly ContactChannel[] = ["telegram", "whatsapp"];

export type BuyerContact = { channel: ContactChannel; value: string };

export type BuyerDetails = { name: string; contact: BuyerContact };

export const NAME_MAX = 80;

/** Trimmed, inner spaces collapsed, at most `NAME_MAX`, with at least one letter; else null. */
export function normalizeBuyerName(raw: string | null | undefined): string | null {
  const name = (raw ?? "").replace(/\s+/g, " ").trim();
  if (!name || name.length > NAME_MAX) return null;
  return /\p{L}/u.test(name) ? name : null;
}

export function parseContactChannel(raw: string | null | undefined): ContactChannel | null {
  return raw === "telegram" || raw === "whatsapp" ? raw : null;
}

/**
 * A phone number as `+<digits>`, 10 to 15 digits (E.164). A Ukrainian number
 * typed the local way, `0XX XXX XX XX`, gets its `+38`, because that is how
 * almost every buyer here will type it.
 */
export function normalizeContactPhone(raw: string): string | null {
  const compact = raw.replace(/[\s().-]/g, "");
  if (!/^\+?\d+$/.test(compact)) return null;
  let digits = compact.replace(/^\+/, "");
  if (!compact.startsWith("+") && /^0\d{9}$/.test(digits)) digits = `38${digits}`;
  if (digits.startsWith("00")) digits = digits.slice(2);
  return digits.length >= 10 && digits.length <= 15 ? `+${digits}` : null;
}

/* Telegram's own rule for a public username: 5–32 characters, Latin letters,
   digits and underscores, starting with a letter. */
const TELEGRAM_USERNAME = /^[A-Za-z][A-Za-z0-9_]{4,31}$/;

/**
 * Telegram: `@username`, `username`, a `t.me/username` link, or the phone the
 * account is on. WhatsApp: a phone, nothing else — WhatsApp has no usernames.
 */
export function normalizeContactValue(channel: ContactChannel, raw: string | null | undefined): string | null {
  const value = (raw ?? "").trim();
  if (!value) return null;
  if (channel === "telegram") {
    const handle = value.replace(/^(?:https?:\/\/)?(?:t\.me|telegram\.me)\//i, "").replace(/^@/, "");
    if (TELEGRAM_USERNAME.test(handle)) return `@${handle}`;
  }
  return normalizeContactPhone(value);
}

/** The whole set the checkout asks for, normalised; null when any part is missing or malformed. */
export function readBuyerDetails(input: {
  name: string | null | undefined;
  channel: string | null | undefined;
  contact: string | null | undefined;
}): BuyerDetails | null {
  const name = normalizeBuyerName(input.name);
  const channel = parseContactChannel(input.channel);
  if (!name || !channel) return null;
  const value = normalizeContactValue(channel, input.contact);
  return value ? { name, contact: { channel, value } } : null;
}

/** Where a person in the admin taps to write to the buyer. */
export function contactHref(contact: BuyerContact): string {
  // Telegram opens `t.me/username` and `t.me/+380…` alike; WhatsApp wants bare digits.
  return contact.channel === "telegram"
    ? `https://t.me/${contact.value.replace(/^@/, "")}`
    : `https://wa.me/${contact.value.replace(/^\+/, "")}`;
}

export const CONTACT_CHANNEL_LABEL: Record<ContactChannel, string> = {
  telegram: "Telegram",
  whatsapp: "WhatsApp",
};
