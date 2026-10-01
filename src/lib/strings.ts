/**
 * Small string helpers that had been written in several places each.
 *
 * `asString` alone existed in ten route handlers, character for character;
 * `escapeHtml` three times with the replacements in three orders (all with
 * `&` first, which is the only order that matters); `normalizeEmail` twice.
 * One copy here, and the sites import it.
 */

/** A non-empty trimmed string, or null. The shape every JSON body field is read through. */
export function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

/** The non-empty trimmed strings of an array, or undefined when there are none. */
export function asStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const items = value.map((item) => (typeof item === "string" ? item.trim() : "")).filter(Boolean);
  return items.length ? items : undefined;
}

/** Lower-cased, trimmed, and null unless it at least contains an `@`. */
export function normalizeEmail(input: string): string | null {
  const value = input.trim().toLowerCase();
  if (!value || !value.includes("@")) return null;
  return value;
}

/**
 * An address as an `ilike` pattern that matches that address, in any case, and
 * nothing else.
 *
 * Customers are looked up by email with `ilike` because the stored column is
 * not reliably lower-cased. Passed raw, the address was a LIKE pattern: `_` is
 * "any one character", so the verified owner of `ivan_petrov@x` matched the
 * customer row of `ivan.petrov@x` and opened that person's courses
 * (meta-audit 2026-09-30). `\`, `%` and `_` are escaped here.
 *
 * PostgREST also reads `*` as `%` and offers no escape for it, so this alone is
 * not exact for an address containing `*`. Where the match decides whose
 * purchases these are, filter the rows again with `sameEmail`.
 */
export function emailIlike(email: string): string {
  return email
    .trim()
    .toLowerCase()
    .replace(/[\\%_]/g, "\\$&");
}

/** The same mailbox as far as the platform is concerned: case and surrounding space ignored. */
export function sameEmail(a: string | null | undefined, b: string | null | undefined): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const left = a.trim().toLowerCase();
  return left !== "" && left === b.trim().toLowerCase();
}

/** The four characters that make text markup, escaped. `&` first, always. */
export function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
