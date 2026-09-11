/**
 * Date and number helpers the analytics code shares.
 *
 * Eight of these were written twice — once in the admin analytics route and
 * once in the Telegram reports module — character for character apart from
 * comments, and `toIsoDate` twice more in the Meta sync and the purchase
 * backfill. One copy. The two engines still compute their metrics separately;
 * this is the arithmetic under both, not the metrics.
 */

export function asFiniteNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function safeDivide(numerator: number, denominator: number): number {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) return 0;
  return numerator / denominator;
}

export function isoDateFromParts(parts: { year: number; month: number; day: number }): string {
  const y = String(parts.year).padStart(4, "0");
  const m = String(parts.month).padStart(2, "0");
  const d = String(parts.day).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function shiftIsoDate(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

export function parseShortOffsetToMs(raw: string): number | null {
  // Examples: "GMT+3", "GMT+03:00", "UTC-04:00"
  const m = raw.match(/([+-])(\d{1,2})(?::?(\d{2}))?$/);
  if (!m) return null;
  const sign = m[1] === "-" ? -1 : 1;
  const hh = Number(m[2] ?? "0");
  const mm = Number(m[3] ?? "0");
  return sign * (hh * 60 + mm) * 60 * 1000;
}

export function getTimeZoneOffsetMs(date: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "shortOffset",
    year: "numeric",
  });
  const tzName = dtf.formatToParts(date).find((p) => p.type === "timeZoneName")?.value ?? "";
  return parseShortOffsetToMs(tzName) ?? 0;
}

export function getIsoDateInTimeZone(date: Date, timeZone: string): string {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = dtf.formatToParts(date);
  const year = Number(parts.find((p) => p.type === "year")?.value ?? "0");
  const month = Number(parts.find((p) => p.type === "month")?.value ?? "0");
  const day = Number(parts.find((p) => p.type === "day")?.value ?? "0");
  return isoDateFromParts({ year, month, day });
}

export function localMidnightUtcIso(isoDate: string, timeZone: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  let ts = Date.UTC(y, m - 1, d, 0, 0, 0, 0);
  // Iterate to handle DST boundaries correctly.
  for (let i = 0; i < 3; i += 1) {
    const offsetMs = getTimeZoneOffsetMs(new Date(ts), timeZone);
    const next = Date.UTC(y, m - 1, d, 0, 0, 0, 0) - offsetMs;
    if (next === ts) break;
    ts = next;
  }
  return new Date(ts).toISOString();
}

export function toIsoDate(input: Date): string {
  return input.toISOString().slice(0, 10);
}
