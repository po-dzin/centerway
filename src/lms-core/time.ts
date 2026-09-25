/**
 * CenterWay LMS core — timezone-aware calendar math.
 *
 * PURE TS. No DOM, no React, no Next, no npm deps — `Intl` only, which exists in
 * Node, browsers and Expo/Hermes (with full-ICU, the Expo default).
 *
 * Why this file exists: drip ("day N") and reminders are meaningless in a single
 * timezone once the audience is spread across Kyiv, Warsaw, Tel Aviv and Vancouver.
 * Instants are ALWAYS stored in UTC; every calendar decision takes the learner's
 * timezone as an explicit argument. See docs/lms-research-2026-08-15.md §3A.4.
 */

export const DEFAULT_TIMEZONE = "Europe/Kyiv";

export type CalendarDate = { year: number; month: number; day: number };

function partsFor(instant: Date, timeZone: string): Intl.DateTimeFormatPart[] {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(instant);
}

function readPart(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): number {
  const raw = parts.find((part) => part.type === type)?.value ?? "0";
  return Number.parseInt(raw, 10);
}

/**
 * Returns true when the IANA zone is understood by the runtime.
 * Unknown zones must never throw at request time — callers fall back to the default.
 */
export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export function resolveTimeZone(timeZone: string | null | undefined): string {
  const candidate = (timeZone ?? "").trim();
  if (!candidate) return DEFAULT_TIMEZONE;
  return isValidTimeZone(candidate) ? candidate : DEFAULT_TIMEZONE;
}

/** The learner's local calendar date at a given instant. */
export function localCalendarDate(instant: Date, timeZone: string): CalendarDate {
  const parts = partsFor(instant, resolveTimeZone(timeZone));
  return {
    year: readPart(parts, "year"),
    month: readPart(parts, "month"),
    day: readPart(parts, "day"),
  };
}

/** The learner's local hour (0–23) at a given instant. */
export function localHour(instant: Date, timeZone: string): number {
  const hour = readPart(partsFor(instant, resolveTimeZone(timeZone)), "hour");
  // Some locales render midnight as 24 under hour12:false.
  return hour === 24 ? 0 : hour;
}

function toDayNumber(date: CalendarDate): number {
  return Math.floor(Date.UTC(date.year, date.month - 1, date.day) / 86_400_000);
}

/**
 * Whole calendar days between two instants as the learner experiences them.
 * DST-safe, because it compares calendar dates rather than subtracting millis.
 */
export function calendarDaysBetween(from: Date, to: Date, timeZone: string): number {
  const zone = resolveTimeZone(timeZone);
  return toDayNumber(localCalendarDate(to, zone)) - toDayNumber(localCalendarDate(from, zone));
}

/**
 * 1-based day number of the enrollment: the start day is day 1, not day 0 —
 * "день 1" must be available the moment a learner buys.
 */
export function enrollmentDayNumber(startedAt: Date, now: Date, timeZone: string): number {
  return calendarDaysBetween(startedAt, now, timeZone) + 1;
}

/** Parses `YYYY-MM-DD`; anything else (including an impossible date) is null. */
export function parseCalendarDate(value: string | null | undefined): CalendarDate | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec((value ?? "").trim());
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (probe.getUTCFullYear() !== year || probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) return null;
  return { year, month, day };
}

/**
 * An instant that falls ON the given calendar date in the given timezone.
 *
 * A cohort starts on a DATE — «6 жовтня» — and that date arrives at a different
 * moment for each learner. Everything downstream counts days from an instant,
 * so the date is turned into one that lands on the right local day: noon UTC,
 * nudged by twelve hours for the few zones (UTC+13, UTC-12) where noon UTC is
 * already tomorrow or still yesterday.
 */
export function instantOnCalendarDate(date: CalendarDate, timeZone: string): Date {
  const zone = resolveTimeZone(timeZone);
  const target = toDayNumber(date);
  const noon = new Date(Date.UTC(date.year, date.month - 1, date.day, 12));
  const drift = toDayNumber(localCalendarDate(noon, zone)) - target;
  return drift === 0 ? noon : new Date(noon.getTime() - drift * 12 * 3_600_000);
}

export function formatCalendarDate(date: CalendarDate): string {
  const month = String(date.month).padStart(2, "0");
  const day = String(date.day).padStart(2, "0");
  return `${date.year}-${month}-${day}`;
}
