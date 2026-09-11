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

/** The four characters that make text markup, escaped. `&` first, always. */
export function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
