/**
 * WHO IS PAYING, BEYOND AN ADDRESS (owner, 2026-10-14): a name to address the
 * buyer by, and a phone or Telegram to reach them by, in one field. An email can bounce, land in spam or carry a typo; a group
 * program needs a channel a person actually reads.
 *
 * Pure, so the checkout form answers in the buyer's words before a round trip
 * and `/api/pay/start` checks the same rules again as the authority.
 */

/** How a buyer can be reached: a phone, or a Telegram username. */
export type ContactChannel = "phone" | "telegram";

export type BuyerContact = { channel: ContactChannel; value: string };

export type BuyerDetails = {
  name: string;
  /** Required: a phone or a Telegram username, typed in one field. */
  contact: BuyerContact;
};

export const NAME_MAX = 80;

/** Trimmed, inner spaces collapsed, at most `NAME_MAX`, with at least one letter; else null. */
export function normalizeBuyerName(raw: string | null | undefined): string | null {
  const name = (raw ?? "").replace(/\s+/g, " ").trim();
  if (!name || name.length > NAME_MAX) return null;
  return /\p{L}/u.test(name) ? name : null;
}

export function parseContactChannel(raw: string | null | undefined): ContactChannel | null {
  return raw === "phone" || raw === "telegram" ? raw : null;
}

/**
 * A phone number as `+<digits>`, 10 to 15 digits (E.164). A Ukrainian number
 * typed the local way, `0XX XXX XX XX`, gets its `+38`, because that is how
 * almost every buyer here will type it.
 */
export function normalizeContactPhone(raw: string | null | undefined): string | null {
  const compact = (raw ?? "").trim().replace(/[\s().-]/g, "");
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
 * THE ONE REQUIRED FIELD, «Телефон або Telegram» (owner, 2026-10-14): a phone
 * number, or a Telegram username however it is pasted — `@anna`, `anna`, a
 * `t.me/anna` link. What was typed decides the channel; the buyer picks none.
 */
export function readPrimaryContact(raw: string | null | undefined): BuyerContact | null {
  const value = (raw ?? "").trim();
  if (!value) return null;
  const handle = value.replace(/^(?:https?:\/\/)?(?:t\.me|telegram\.me)\//i, "").replace(/^@/, "");
  if (TELEGRAM_USERNAME.test(handle)) return { channel: "telegram", value: `@${handle}` };
  const phone = normalizeContactPhone(value);
  return phone ? { channel: "phone", value: phone } : null;
}

/** The whole set the checkout asks for, normalised; null when the name or the contact is missing or malformed. */
export function readBuyerDetails(input: {
  name: string | null | undefined;
  contact: string | null | undefined;
}): BuyerDetails | null {
  const name = normalizeBuyerName(input.name);
  const contact = readPrimaryContact(input.contact);
  return name && contact ? { name, contact } : null;
}

/** Where a person in the admin taps to reach the buyer. */
export function contactHref(contact: BuyerContact): string {
  return contact.channel === "telegram" ? `https://t.me/${contact.value.replace(/^@/, "")}` : `tel:${contact.value}`;
}

export const CONTACT_CHANNEL_LABEL: Record<ContactChannel, string> = {
  phone: "Телефон",
  telegram: "Telegram",
};
