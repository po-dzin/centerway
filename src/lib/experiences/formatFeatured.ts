import type { ProgramFormat } from "./formats";

/**
 * Which format of a program carries the one gold button, and how far its
 * cohort is (G, 2026-10-03).
 *
 * A row of formats is one view, and the button contract allows one primary per
 * view (docs/design-system.md, «Five roles»). Three gold buttons side by side
 * asked three questions at once. The one that keeps the gold is the format the
 * owner marked «Бестселер» in the builder (`experience_offers.featured`) — a
 * claim about what sells is the owner's, like the price. Without a mark every
 * button in the row is secondary; a program with one format has nothing to
 * compare, and its one button stays primary.
 *
 * The nearest cohort ahead is information, not the gold: it says «Найближчий
 * потік» and counts the days to its start (`nearestCohort`).
 *
 * Shared by the program page (OfferFormats) and the landings (formatSync), so
 * both mark the same card.
 */

const DAY_MS = 86_400_000;

function utcDay(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

/** Whole days from `now` to the ISO date; null when unreadable or past. */
export function daysUntil(isoDate: string | null, now: Date = new Date()): number | null {
  if (!isoDate) return null;
  const start = Date.parse(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(start)) return null;
  const days = Math.round((start - utcDay(now)) / DAY_MS);
  return days >= 0 ? days : null;
}

/** The code of the owner's «Бестселер» format; null when none is marked. */
export function featuredFormat(formats: ProgramFormat[]): string | null {
  return formats.find((format) => format.featured)?.code ?? null;
}

/** Whether this format's button is the row's primary: the marked one, or the only one. */
export function isPrimaryFormat(formats: ProgramFormat[], code: string): boolean {
  return formats.length < 2 || featuredFormat(formats) === code;
}

/** The group format whose cohort starts soonest, still ahead; null when none is. */
export function nearestCohort(formats: ProgramFormat[], now: Date = new Date()): string | null {
  const next = formats
    .filter((format) => format.format === "group")
    .map((format) => ({ code: format.code, days: daysUntil(format.cohortStartsOn, now) }))
    .filter((entry): entry is { code: string; days: number } => entry.days !== null)
    .sort((a, b) => a.days - b.days)[0];
  return next?.code ?? null;
}

/** «через 29 днів», «через 2 дні», «через 1 день», «сьогодні». */
export function countdownText(days: number): string {
  if (days === 0) return "сьогодні";
  const tens = days % 100;
  const ones = days % 10;
  const word = tens >= 11 && tens <= 14 ? "днів" : ones === 1 ? "день" : ones >= 2 && ones <= 4 ? "дні" : "днів";
  return `через ${days} ${word}`;
}
