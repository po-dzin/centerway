/**
 * ONE CHOICE, TWO CONSEQUENCES (2026-09-14).
 *
 * «Термін доступу» used to be two unrelated things that happened to share a
 * name. The builder let an author pick the words the storefront prints beside
 * the price («30 днів», «Назавжди»); the admin catalogue separately set the
 * rule that actually ends a buyer's access (`lms_course_offers.access_days` /
 * `access_lifetime`). Nothing made them agree, so a page could promise «Назавжди»
 * over an offer that expired in thirty days — the one direction a buyer finds
 * out about after paying.
 *
 * Now the preset IS the rule. The author's choice carries both: the words, and
 * the term the offer grants. The price stays the owner's alone
 * (`creator-contract-price-split`) — this module knows nothing about money.
 *
 * Pure on purpose: the builder's client, the save path, the approval path and
 * the admin catalogue all read the same table from here.
 */

export type AccessRule = { accessDays: number | null; accessLifetime: boolean };

export const ACCESS_TERM_PRESETS = [
  { note: "30 днів", accessDays: 30, accessLifetime: false },
  { note: "60 днів", accessDays: 60, accessLifetime: false },
  { note: "90 днів", accessDays: 90, accessLifetime: false },
  { note: "Пів року", accessDays: 180, accessLifetime: false },
  { note: "Рік", accessDays: 365, accessLifetime: false },
  { note: "Назавжди", accessDays: null, accessLifetime: true },
] as const;

export type AccessTermNote = (typeof ACCESS_TERM_PRESETS)[number]["note"];

export const ACCESS_TERM_NOTES: readonly AccessTermNote[] = ACCESS_TERM_PRESETS.map((preset) => preset.note);

/** The rule a storefront note stands for, or null for words that are not a preset. */
export function accessRuleForNote(note: string | null | undefined): AccessRule | null {
  const trimmed = note?.trim();
  if (!trimmed) return null;
  const preset = ACCESS_TERM_PRESETS.find((candidate) => candidate.note === trimmed);
  return preset ? { accessDays: preset.accessDays, accessLifetime: preset.accessLifetime } : null;
}

/**
 * The words for a rule the admin set in the catalogue.
 *
 * A preset's own label where one matches. The catalogue also offers terms the
 * author's list does not (7 and 14 days); those still get honest words rather
 * than none, so the page never falls silent about a real limit.
 */
export function noteForAccessRule(rule: AccessRule): string {
  if (rule.accessLifetime) return "Назавжди";
  const preset = ACCESS_TERM_PRESETS.find((candidate) => candidate.accessDays === rule.accessDays);
  if (preset) return preset.note;
  return `${rule.accessDays} днів`;
}

/** Whether an offer's current rule already says what the note asks for. */
export function sameAccessRule(a: AccessRule, b: AccessRule): boolean {
  if (a.accessLifetime || b.accessLifetime) return a.accessLifetime === b.accessLifetime;
  return a.accessDays === b.accessDays;
}
