import type { ProgramFormat } from "./formats";

/**
 * Which format of a program carries the one gold button, and how far its
 * cohort is (G, 2026-10-03).
 *
 * A row of formats is one view, and the button contract allows one primary per
 * view (docs/design-system.md, «Five roles»). Three gold buttons side by side
 * asked three questions at once. The one that keeps the gold is the nearest
 * cohort still ahead: a group stage is the moment the program is built around,
 * and the date is the reason to decide now. Without one, the self-paced format
 * — the program itself — takes it. The others go secondary.
 *
 * Shared by the program page (OfferFormats) and the landings (formatSync), so
 * both highlight the same card.
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

/** The code of the format that keeps the primary action; null for a single format. */
export function featuredFormat(formats: ProgramFormat[], now: Date = new Date()): string | null {
  if (formats.length < 2) return null;
  const cohort = formats
    .filter((format) => format.format === "group")
    .map((format) => ({ format, days: daysUntil(format.cohortStartsOn, now) }))
    .filter((entry): entry is { format: ProgramFormat; days: number } => entry.days !== null)
    .sort((a, b) => a.days - b.days)[0];
  if (cohort) return cohort.format.code;
  return (formats.find((format) => format.format === "self") ?? formats[0]!).code;
}

/** «через 29 днів», «через 2 дні», «через 1 день», «сьогодні». */
export function countdownText(days: number): string {
  if (days === 0) return "сьогодні";
  const tens = days % 100;
  const ones = days % 10;
  const word = tens >= 11 && tens <= 14 ? "днів" : ones === 1 ? "день" : ones >= 2 && ones <= 4 ? "дні" : "днів";
  return `через ${days} ${word}`;
}
