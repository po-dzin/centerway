/**
 * The early price of a format, and what it costs right now (G, 2026-10-03).
 *
 * `amount` is the price after the date; `earlyAmount` holds until 00:00 Kyiv
 * on `earlyUntil`. Shared by the checkout (`loadPayableOffer`) and the program
 * page (`loadProgramFormats`), so what the page quotes is what the gateway is
 * asked for. Pure: no clock of its own, `now` is passed in.
 */

export type EarlyPriceFields = {
  amount: number | null;
  listAmount: number | null;
  earlyAmount: number | null;
  /** `YYYY-MM-DD`: the first day at the later price. */
  earlyUntil: string | null;
};

export type CurrentPrice = {
  amount: number | null;
  /** What is struck through: the later price while the early one holds, else the stored list price. */
  listAmount: number | null;
  /** Present while the early price holds. */
  early: { until: string; endsAt: string; laterAmount: number } | null;
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Kyiv's offset from UTC at `instant`, in minutes (+120 in winter, +180 in summer). */
function kyivOffsetMinutes(instant: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Kyiv",
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  const local = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"));
  return Math.round((local - instant.getTime()) / 60_000);
}

/** The instant 00:00 Kyiv begins on `date`; null for an unreadable date. */
export function kyivMidnight(date: string): Date | null {
  if (!ISO_DATE.test(date)) return null;
  const utcMidnight = Date.parse(`${date}T00:00:00Z`);
  if (Number.isNaN(utcMidnight)) return null;
  // The offset just before Kyiv midnight is the one in force at it: a DST
  // switch happens at 03:00/04:00 local, never at midnight.
  const offset = kyivOffsetMinutes(new Date(utcMidnight - 3 * 3_600_000));
  return new Date(utcMidnight - offset * 60_000);
}

export function currentPrice(fields: EarlyPriceFields, now: Date = new Date()): CurrentPrice {
  const plain: CurrentPrice = { amount: fields.amount, listAmount: fields.listAmount, early: null };
  const { amount, earlyAmount, earlyUntil } = fields;
  if (amount === null || earlyAmount === null || !earlyUntil) return plain;
  if (!(earlyAmount > 0 && earlyAmount < amount)) return plain;
  const endsAt = kyivMidnight(earlyUntil);
  if (!endsAt || now.getTime() >= endsAt.getTime()) return plain;
  return {
    amount: earlyAmount,
    listAmount: amount,
    early: { until: earlyUntil, endsAt: endsAt.toISOString(), laterAmount: amount },
  };
}
