/* The dashboard's arithmetic: dates, scales, ticks, labels.
 *
 * Every function here is pure and every one of them can be wrong in a way a
 * screenshot would not show — a month grid that starts on the wrong weekday, a
 * "nice" axis that rounds a maximum below the tallest bar, a preset that reads
 * one day short. They lived inside a 2583-line client component where nothing
 * could reach them; here they are covered by format.test.ts. */

import type { DateRange } from "@/lib/admin/analytics/types";

export function toNumberInput(value: string): number {
  const num = Number(value);
  return Number.isFinite(num) && num >= 0 ? num : 0;
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

export function formatDateLocal(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function shiftedDate(daysBack: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysBack);
  return formatDateLocal(d);
}

export function clampIsoToToday(value: string): string {
  const todayIso = formatDateLocal(new Date());
  return value > todayIso ? todayIso : value;
}

export function isIsoDateInput(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function formatCompactTick(value: number, locale: string): string {
  if (value <= 0) return "0";
  return new Intl.NumberFormat(locale, {
    notation: "compact",
    maximumFractionDigits: value >= 1000 ? 1 : 0,
  }).format(value);
}

/**
 * THE SERVER NAMES THE PRODUCT NOW (see `productIdentity.ts`).
 *
 * This used to be a three-name switch — `short`/`reboot` → "Short Reboot",
 * `irem` → "IREM Gymnastics", everything else raw — written before the builder
 * sold anything. Every course that shipped after 2026-08-26 fell through it and
 * rendered as its own product code, and a course renamed by its author kept the
 * old name here until someone edited this file.
 *
 * `product_title` arrives resolved from `lms_courses`, so the only judgement
 * left on this side is what to print when a code delivers no course at all.
 */
export function formatProductName(
  product: { product_code: string; product_title?: string | null },
  unknownLabel: string,
): string {
  if (product.product_title) return product.product_title;
  const normalized = product.product_code.trim().toLowerCase();
  if (!normalized || normalized === "unknown") return unknownLabel;
  return product.product_code;
}

export function buildNiceScale(maxValue: number, tickCount = 5): { scaleMax: number; ticks: number[] } {
  if (!Number.isFinite(maxValue) || maxValue <= 0 || tickCount < 2) {
    return { scaleMax: 1, ticks: [0, 0.25, 0.5, 0.75, 1] };
  }

  const rawStep = maxValue / (tickCount - 1);
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const residual = rawStep / magnitude;
  const niceResidual = residual <= 1 ? 1 : residual <= 2 ? 2 : residual <= 2.5 ? 2.5 : residual <= 5 ? 5 : 10;
  const step = niceResidual * magnitude;
  const scaleMax = Math.ceil(maxValue / step) * step;
  const ticks = Array.from({ length: tickCount }, (_, index) => index * step);

  return { scaleMax, ticks };
}

export function normalizeDateRange(range: DateRange): DateRange {
  const clampedFromDate = clampIsoToToday(range.from);
  const clampedToDate = clampIsoToToday(range.to);
  const from = clampedFromDate <= clampedToDate ? clampedFromDate : clampedToDate;
  const to = clampedToDate >= clampedFromDate ? clampedToDate : clampedFromDate;
  return { from, to };
}

export type RangePresetKey = "7d" | "30d" | "mtd" | "90d" | "1y";

export function buildPresetRange(preset: RangePresetKey): DateRange {
  if (preset === "mtd") {
    const now = new Date();
    return {
      from: `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-01`,
      to: formatDateLocal(now),
    };
  }

  const days = preset === "7d" ? 7 : preset === "30d" ? 30 : preset === "90d" ? 90 : 365;
  return {
    from: shiftedDate(days - 1),
    to: formatDateLocal(new Date()),
  };
}

export function detectActivePreset(range: DateRange): RangePresetKey | null {
  const normalized = normalizeDateRange(range);
  const presets: RangePresetKey[] = ["7d", "30d", "mtd", "90d", "1y"];
  for (const preset of presets) {
    const candidate = normalizeDateRange(buildPresetRange(preset));
    if (candidate.from === normalized.from && candidate.to === normalized.to) {
      return preset;
    }
  }
  return null;
}

export function freshnessStatus(isoTs: string | null, staleAfterHours: number): "ok" | "warn" | "empty" {
  if (!isoTs) return "empty";
  const ts = Date.parse(isoTs);
  if (!Number.isFinite(ts)) return "empty";
  const diffMs = Date.now() - ts;
  const staleMs = staleAfterHours * 60 * 60 * 1000;
  return diffMs <= staleMs ? "ok" : "warn";
}

export function funnelSourceLabel(
  t: (key: never) => string,
  source:
    | "local_events"
    | "local_events_floored"
    | "pixel_daily_stats"
    | "pixel_stats_reference"
    | "pixel_fallback"
    | "capi_fallback"
    | "meta_daily"
    | "manual_input"
    | "orders_created"
    | "paid_orders"
    | "access_delivered",
): string {
  if (source === "local_events") return t("analytics_source_local_events" as never);
  if (source === "local_events_floored") return t("analytics_source_local_events_floored" as never);
  if (source === "pixel_daily_stats") return t("analytics_source_pixel_daily_stats" as never);
  if (source === "pixel_stats_reference") return t("analytics_source_pixel_stats_reference" as never);
  if (source === "pixel_fallback") return t("analytics_source_pixel_fallback" as never);
  if (source === "capi_fallback") return t("analytics_source_capi_fallback" as never);
  if (source === "meta_daily") return t("analytics_source_meta_daily" as never);
  if (source === "manual_input") return t("analytics_source_manual_input" as never);
  if (source === "orders_created") return t("analytics_source_orders_created" as never);
  if (source === "paid_orders") return t("analytics_source_paid_orders" as never);
  /* `token_consumed` was retired when access stopped being proved by a token:
     the engine now counts an enrolment or a sent receipt and labels the source
     `access_delivered`. The branch outlived its dictionary key by one merge,
     which would have printed the key itself into the admin. */
  return t("analytics_source_access_delivered" as never);
}

export function isoToDate(value: string): Date | null {
  if (!isIsoDateInput(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (year === undefined || month === undefined || day === undefined) return null;
  const date = new Date(year, month - 1, day);
  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

export function buildMonthGrid(viewMonth: Date): Date[] {
  const monthStart = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1);
  const weekDayMondayFirst = (monthStart.getDay() + 6) % 7;
  const gridStart = new Date(monthStart);
  gridStart.setDate(monthStart.getDate() - weekDayMondayFirst);

  return Array.from({ length: 42 }, (_, idx) => {
    const day = new Date(gridStart);
    day.setDate(gridStart.getDate() + idx);
    return day;
  });
}
