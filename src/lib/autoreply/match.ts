/**
 * Which comments a rule answers, and which of its texts goes out.
 *
 * Matching is on purpose forgiving in the ways people actually type: case, a
 * trailing «!», an apostrophe or a hyphen in the middle of a word do not make
 * «Доша!!» a different word from «доша». It is not a language model: a rule
 * answers a word the owner wrote down, nothing else.
 */

export const MAX_VARIANTS = 5;

/** Lowercase, ё→е, strip anything that is not a letter or a digit, collapse spaces. */
export function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** The keyword list as stored: normalized, de-duplicated, no empty entries. */
export function normalizeKeywords(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const word = normalizeText(item);
    if (word) seen.add(word);
  }
  return [...seen];
}

/**
 * True when the comment contains one of the keywords as a whole word (or, for a
 * keyword of several words, as a run of whole words). «дошу» does not match
 * inside «подошла»: a word is matched at its edges.
 */
export function matchesKeyword(comment: string, keywords: string[]): boolean {
  const text = ` ${normalizeText(comment)} `;
  if (text.trim() === "") return false;
  return keywords.some((keyword) => {
    const word = normalizeText(keyword);
    return word !== "" && text.includes(` ${word} `);
  });
}

/** One of the variants, chosen with `random` (0 ≤ r < 1) so a test can pin it. */
export function pickVariant<T>(variants: T[], random: () => number = Math.random): T | null {
  if (variants.length === 0) return null;
  const index = Math.min(variants.length - 1, Math.floor(random() * variants.length));
  return variants[index] ?? null;
}

/** A list of texts as stored: strings only, trimmed, no blanks, at most `MAX_VARIANTS`. */
export function cleanVariants(raw: unknown, maxLength: number): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim().slice(0, maxLength))
    .filter((item) => item !== "")
    .slice(0, MAX_VARIANTS);
}
