/**
 * Value formatting shared by the two pages of "mine".
 *
 * Lifted out of CabinetClient when the shelf became its own route: a date on
 * the shelf and a date in the dashboard have to read the same, and the way to
 * guarantee that is one function, not two copies that agree today.
 */

import type { Session } from "@supabase/supabase-js";

import type { ProfileLang, ProfileResponse } from "@/components/platform/profile/types";

export function fmtDate(value: string | null | undefined, locale: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(locale, { day: "2-digit", month: "long", year: "numeric" }).format(date);
}

export function fmtShortDate(value: string | null | undefined, locale: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(locale, { day: "2-digit", month: "2-digit", year: "2-digit" }).format(date);
}

export function fmtMoney(amount: number | null | undefined, currency: string | null | undefined) {
  if (typeof amount !== "number") return "—";
  return `${amount} ${currency ?? ""}`.trim();
}

export function dateLocaleFor(lang: ProfileLang) {
  return lang === "en" ? "en-US" : "uk-UA";
}

/**
 * How a linked Telegram account is addressed in the profile.
 *
 * The @handle when there is one, because a numeric id ("849575647") tells the
 * reader nothing about which account is connected — which is the only question
 * this row exists to answer. Not every Telegram account has a public username,
 * so the id remains the fallback rather than being hidden: "connected, but I
 * cannot name it" beats an em dash that reads as "not connected".
 */
export function formatTelegram(
  contacts: ProfileResponse["profile"]["contacts"],
  emptyValue: string,
): string {
  if (contacts?.telegramUsername) return `@${contacts.telegramUsername}`;
  if (contacts?.telegram) return contacts.telegram;
  return emptyValue;
}

export function getUserInitial(session: Session | null, fullName: string | null | undefined) {
  const source =
    fullName ||
    session?.user?.user_metadata?.full_name ||
    session?.user?.user_metadata?.name ||
    session?.user?.email ||
    "";
  return source.trim().charAt(0).toUpperCase() || "?";
}

export function isProgramKind(kind: string) {
  return kind === "program" || kind === "mini-course";
}

export function isAccessActive(expiresAt: string | null | undefined) {
  if (!expiresAt) return true;
  const expiry = new Date(expiresAt).getTime();
  return Number.isFinite(expiry) && expiry > Date.now();
}

export function formatDoshaResult(resultType: string | null | undefined, lang: ProfileLang) {
  const raw = (resultType ?? "").trim().toLowerCase();
  // The em dash, not a phrase: this value only ever renders in the identity
  // tile, and that slot takes values. "No test taken yet" is said properly in
  // the dosha card below, where it comes with the button that fixes it.
  if (!raw) return "—";

  const dictionary =
    lang === "en"
      ? { vata: "Vata", pitta: "Pitta", kapha: "Kapha", tridosha: "Tridosha", tridoshic: "Tridoshic" }
      : { vata: "Вата", pitta: "Пітта", kapha: "Капха", tridosha: "Тридоша", tridoshic: "Тридоша" };

  /* Split on the separators the codes actually use, rather than matching word
     boundaries: `_` is a word character in JS regex, so `\b(vata)\b` never
     matched inside `vata_pitta` and a dual result rendered as its raw code.
     Joined with a hyphen, which is also the break the identity tile relies on. */
  return raw
    .split(/[_\-\s]+/)
    .filter(Boolean)
    .map((token) => dictionary[token as keyof typeof dictionary] ?? token)
    .join("-");
}

export function formatAccessStatus(used: boolean, expiresAt: string | null | undefined, lang: ProfileLang) {
  if (used) return lang === "en" ? "Access used" : "Доступ використано";
  if (!expiresAt) return lang === "en" ? "Access created" : "Доступ створено";

  const expiry = new Date(expiresAt).getTime();
  if (Number.isFinite(expiry) && Date.now() > expiry) {
    return lang === "en" ? "Access expired" : "Термін доступу минув";
  }

  return lang === "en" ? "Access active" : "Доступ активний";
}
