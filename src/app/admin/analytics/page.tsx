"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { flushSync } from "react-dom";
import { supabaseClient } from "@/lib/supabaseClient";
import { useI18n } from "@/components/I18nProvider";
import { getErrorMessage } from "@/lib/errors";
import { useToast } from "@/components/ToastProvider";
import { AdminTabs } from "@/components/admin/AdminTabs";
import { AdminLoadingState } from "@/components/admin/AdminLoadingState";
import { AdminErrorState } from "@/components/admin/AdminErrorState";

type FunnelData = {
  date: string;
  leads_count: number;
  unique_lead_phones: number;
  orders_created: number;
  orders_paid: number;
  total_revenue: number;
  conversion_rate_percent: string;
};

type CampaignData = {
  source_campaign: string;
  total_orders: number;
  paid_orders: number;
  total_revenue: number;
  view_content: number;
  impressions: number;
  reach: number;
  spend: number;
  currency: string;
};

type AnalyticsSummary = {
  totalLeads: number;
  totalPaidOrders: number;
  totalRevenue: number;
  avgConversionRate: string;
};

type CapiEventName = "ViewContent" | "InitiateCheckout" | "Purchase";

type CapiEventStats = {
  event_name: CapiEventName;
  total: number;
  success: number;
  pending: number;
  running: number;
  failed: number;
  last_seen_at: string | null;
};

type CapiOverview = {
  total: number;
  success: number;
  pending: number;
  running: number;
  failed: number;
};

type FunnelChain = {
  view_content: number;
  initiate_checkout: number;
  purchase: number;
  access_granted: number;
  view_to_checkout_percent: number;
  checkout_to_purchase_percent: number;
  purchase_to_access_percent: number;
};

type MarketingInputs = {
  reach: number;
  impressions: number;
  clicks: number;
  spend: number;
  currency: string;
  period_label: string | null;
  updated_at: string | null;
  source?: "meta" | "manual";
};

type UnifiedKpis = {
  cpa: number;
  cpc: number;
  ctr_percent: number;
  roas: number;
  roi_percent: number;
};

type QualityGaps = {
  snapshot_date: string;
  paid_missing_fbclid: number;
  paid_missing_fbp: number;
  paid_missing_page_url: number;
  paid_missing_client_ip: number;
  paid_missing_client_ua: number;
};

type AnalyticsFreshness = {
  local_view_content_last_at: string | null;
  local_scroll_depth_50_last_at: string | null;
  orders_created_last_at: string | null;
  orders_paid_last_at: string | null;
  capi_last_sent_at: string | null;
  meta_last_synced_at: string | null;
  pixel_daily_last_synced_at: string | null;
  quality_snapshot_date: string | null;
};

type QualitySeriesRow = {
  date: string;
  paid_orders: number;
  missing_fbclid: number;
  missing_fbp: number;
  missing_page_url: number;
  missing_client_ip: number;
  missing_client_ua: number;
};

type AnalyticsResponse = {
  period?: {
    from: string;
    to: string;
  };
  funnel: FunnelData[];
  campaigns: CampaignData[];
  summary: AnalyticsSummary;
  capi_events: CapiEventStats[];
  capi_overview: CapiOverview;
  funnel_chain: FunnelChain;
  funnel_sources?: {
    view_content:
      | "local_events"
      | "local_events_floored"
      | "pixel_daily_stats"
      | "pixel_stats_reference"
      | "pixel_fallback"
      | "capi_fallback";
    initiate_checkout: "orders_created";
    purchase: "paid_orders";
    access_granted: "token_consumed";
  };
  business_events: {
    view_content: number;
    initiate_checkout: number;
    purchase: number;
    access_granted: number;
  };
  engagement?: {
    scroll_depth_50: number;
    initiate_checkout_aligned: number;
    scroll50_to_checkout_percent: number;
    aligned_from: string | null;
  };
  marketing_inputs: MarketingInputs;
  quality_gaps?: QualityGaps | null;
  quality_series?: QualitySeriesRow[];
  freshness?: AnalyticsFreshness | null;
  kpis: UnifiedKpis;
};

type DateRange = {
  from: string;
  to: string;
};

type FunnelMode = "payment" | "access";

type FunnelUiSettings = {
  mode: FunnelMode;
  showLeadsCard: boolean;
  showAccessGrantedCard: boolean;
};

type MetricFieldKey =
  | "revenue"
  | "reach"
  | "impressions"
  | "frequency"
  | "clicks"
  | "spend"
  | "cpa"
  | "cpc"
  | "roas"
  | "roi";

type MetricDef = {
  key: MetricFieldKey;
  labelKey: string;
};

const PRIMARY_METRIC_FIELDS: MetricDef[] = [
  { key: "spend", labelKey: "analytics_metric_spend" },
  { key: "revenue", labelKey: "analytics_metric_revenue" },
  { key: "roas", labelKey: "analytics_metric_roas" },
  { key: "cpa", labelKey: "analytics_metric_cpa" },
  { key: "roi", labelKey: "analytics_metric_roi" },
];

const OPTIONAL_METRIC_FIELDS: MetricDef[] = [
  { key: "reach", labelKey: "analytics_metric_reach" },
  { key: "impressions", labelKey: "analytics_metric_impressions" },
  { key: "frequency", labelKey: "analytics_metric_frequency" },
  { key: "clicks", labelKey: "analytics_metric_clicks" },
  { key: "cpc", labelKey: "analytics_metric_cpc" },
];

const METRIC_FIELDS: MetricDef[] = [...PRIMARY_METRIC_FIELDS, ...OPTIONAL_METRIC_FIELDS];

const METRIC_VISIBILITY_KEY = "cw_analytics_visible_metrics";
const FUNNEL_UI_SETTINGS_KEY = "cw_analytics_funnel_ui_settings";

function metricEventLabelKey(eventName: CapiEventName): string {
  if (eventName === "ViewContent") return "analytics_event_view_content";
  if (eventName === "InitiateCheckout") return "analytics_event_initiate_checkout";
  return "analytics_event_purchase";
}

function toNumberInput(value: string): number {
  const num = Number(value);
  return Number.isFinite(num) && num >= 0 ? num : 0;
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function formatDateLocal(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function shiftedDate(daysBack: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysBack);
  return formatDateLocal(d);
}

function clampIsoToToday(value: string): string {
  const todayIso = formatDateLocal(new Date());
  return value > todayIso ? todayIso : value;
}

function isIsoDateInput(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function formatCompactTick(value: number, locale: string): string {
  if (value <= 0) return "0";
  return new Intl.NumberFormat(locale, {
    notation: "compact",
    maximumFractionDigits: value >= 1000 ? 1 : 0,
  }).format(value);
}

function buildNiceScale(maxValue: number, tickCount = 5): { scaleMax: number; ticks: number[] } {
  if (!Number.isFinite(maxValue) || maxValue <= 0 || tickCount < 2) {
    return { scaleMax: 1, ticks: [0, 0.25, 0.5, 0.75, 1] };
  }

  const rawStep = maxValue / (tickCount - 1);
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const residual = rawStep / magnitude;
  const niceResidual =
    residual <= 1 ? 1 :
      residual <= 2 ? 2 :
        residual <= 2.5 ? 2.5 :
          residual <= 5 ? 5 : 10;
  const step = niceResidual * magnitude;
  const scaleMax = Math.ceil(maxValue / step) * step;
  const ticks = Array.from({ length: tickCount }, (_, index) => index * step);

  return { scaleMax, ticks };
}

function normalizeDateRange(range: DateRange): DateRange {
  const clampedFromDate = clampIsoToToday(range.from);
  const clampedToDate = clampIsoToToday(range.to);
  const from = clampedFromDate <= clampedToDate ? clampedFromDate : clampedToDate;
  const to = clampedToDate >= clampedFromDate ? clampedToDate : clampedFromDate;
  return { from, to };
}

type RangePresetKey = "7d" | "30d" | "mtd" | "90d";

function buildPresetRange(preset: RangePresetKey): DateRange {
  if (preset === "mtd") {
    const now = new Date();
    return {
      from: `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-01`,
      to: formatDateLocal(now),
    };
  }

  const days = preset === "7d" ? 7 : preset === "30d" ? 30 : 90;
  return {
    from: shiftedDate(days - 1),
    to: formatDateLocal(new Date()),
  };
}

function detectActivePreset(range: DateRange): RangePresetKey | null {
  const normalized = normalizeDateRange(range);
  const presets: RangePresetKey[] = ["7d", "30d", "mtd", "90d"];
  for (const preset of presets) {
    const candidate = normalizeDateRange(buildPresetRange(preset));
    if (candidate.from === normalized.from && candidate.to === normalized.to) {
      return preset;
    }
  }
  return null;
}

function freshnessStatus(
  isoTs: string | null,
  staleAfterHours: number
): "ok" | "warn" | "empty" {
  if (!isoTs) return "empty";
  const ts = Date.parse(isoTs);
  if (!Number.isFinite(ts)) return "empty";
  const diffMs = Date.now() - ts;
  const staleMs = staleAfterHours * 60 * 60 * 1000;
  return diffMs <= staleMs ? "ok" : "warn";
}

function funnelSourceLabel(
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
    | "token_consumed"
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
  return t("analytics_source_token_consumed" as never);
}

function isoToDate(value: string): Date | null {
  if (!isIsoDateInput(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
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

function buildMonthGrid(viewMonth: Date): Date[] {
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

type DateRangePickerProps = {
  value: DateRange;
  onApply: (next: DateRange) => Promise<void> | void;
  applyLabel: string;
  locale: string;
  className?: string;
};

function DateRangePicker({ value, onApply, applyLabel, locale, className = "" }: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [selectingEnd, setSelectingEnd] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [draftRange, setDraftRange] = useState<DateRange>(() => normalizeDateRange(value));
  const selectedFromDate = useMemo(() => isoToDate(draftRange.from), [draftRange.from]);
  const [viewMonth, setViewMonth] = useState<Date>(() => selectedFromDate ?? new Date());

  useEffect(() => {
    if (!open) {
      setDraftRange(normalizeDateRange(value));
      setSelectingEnd(false);
    }
  }, [open, value]);

  useEffect(() => {
    if (open && selectedFromDate) {
      setViewMonth(new Date(selectedFromDate.getFullYear(), selectedFromDate.getMonth(), 1));
    }
  }, [open, selectedFromDate]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  const monthLabel = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(viewMonth);
  const dayNames = useMemo(() => {
    const monday = new Date(Date.UTC(2024, 0, 1)); // Monday
    return Array.from({ length: 7 }, (_, idx) => {
      const date = new Date(monday);
      date.setUTCDate(monday.getUTCDate() + idx);
      return new Intl.DateTimeFormat(locale, { weekday: "short" }).format(date);
    });
  }, [locale]);
  const days = useMemo(() => buildMonthGrid(viewMonth), [viewMonth]);
  const todayIso = formatDateLocal(new Date());
  const activePreset = detectActivePreset(draftRange);

  const formatDisplayDate = (iso: string) => {
    const date = isoToDate(iso);
    if (!date) return "YYYY-MM-DD";
    return date.toLocaleDateString(locale, { day: "2-digit", month: "2-digit", year: "numeric" });
  };

  const selectDate = (iso: string) => {
    if (iso > todayIso) return;
    if (!selectingEnd) {
      setDraftRange({ from: iso, to: iso });
      setSelectingEnd(true);
      return;
    }
    const next = normalizeDateRange({ from: draftRange.from, to: iso });
    setDraftRange(next);
    setSelectingEnd(false);
  };

  const applyRange = async () => {
    const normalized = normalizeDateRange(draftRange);
    setDraftRange(normalized);
    setSelectingEnd(false);
    setOpen(false);
    await onApply(normalized);
  };

  const applyPresetQuick = async (preset: RangePresetKey) => {
    const next = normalizeDateRange(buildPresetRange(preset));
    setDraftRange(next);
    setSelectingEnd(false);
    setOpen(false);
    await onApply(next);
  };

  const renderMonth = (monthDays: Date[], monthDate: Date) => (
    <div className="w-full">
      <div className="grid grid-cols-7 gap-0.5 mb-0.5">
        {dayNames.map((name) => (
          <div key={`${monthDate.getMonth()}-${name}`} className="h-6 text-[10px] cw-muted flex items-center justify-center uppercase">
            {name}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 auto-rows-[32px] gap-0">
        {monthDays.map((day) => {
          const iso = formatDateLocal(day);
          const isCurrentMonth = day.getMonth() === monthDate.getMonth();
          const isFuture = iso > todayIso;
          const isStart = draftRange.from === iso;
          const isEnd = draftRange.to === iso;
          const isSingle = isStart && isEnd;
          const inRange = iso >= draftRange.from && iso <= draftRange.to;
          const isToday = iso === todayIso;
          const rangeShapeClass = isSingle
            ? "rounded-md border-[var(--cw-interactive-active-border)]"
            : isStart
              ? "rounded-l-md rounded-r-none border-r-0 border-[var(--cw-interactive-active-border)]"
              : isEnd
                ? "rounded-r-md rounded-l-none border-l-0 border-[var(--cw-interactive-active-border)]"
                : "rounded-none border-transparent";

          return (
            <button
              key={`${monthDate.getMonth()}-${iso}`}
              type="button"
              disabled={isFuture}
              onClick={() => selectDate(iso)}
              className={`h-8 border text-xs transition-colors ${
                isFuture
                  ? "border-transparent cw-muted opacity-35 cursor-not-allowed"
                  : inRange
                    ? `cw-text bg-[var(--cw-interactive-active-bg)] ${rangeShapeClass}`
                    : isCurrentMonth
                      ? "border-transparent cw-text hover:bg-[var(--cw-interactive-hover-bg)] rounded-md"
                      : "border-transparent cw-muted opacity-65 hover:bg-[var(--cw-interactive-hover-bg)] rounded-md"
              } ${isToday && !inRange && !isFuture ? "border cw-border" : ""} ${isSingle || isStart || isEnd ? "font-semibold" : ""}`}
            >
              {day.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div ref={rootRef} className={`relative w-full sm:w-[340px] ${className}`.trim()}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="cw-input w-full h-10 px-3 text-sm flex items-center justify-between gap-2"
      >
        <span className="cw-text truncate">
          {formatDisplayDate(draftRange.from)} - {formatDisplayDate(draftRange.to)}
        </span>
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="cw-muted">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-2 z-40 w-full cw-surface-solid border cw-border rounded-xl cw-shadow p-2.5 space-y-2.5">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setViewMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
              className="cw-icon-btn"
              aria-label="Previous month"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
            </button>
            <div className="text-sm font-semibold cw-text capitalize">{monthLabel}</div>
            <button
              type="button"
              onClick={() => setViewMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
              className="cw-icon-btn"
              aria-label="Next month"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
            </button>
          </div>

          {renderMonth(days, viewMonth)}

          <div className="flex items-center gap-2 border-t cw-border pt-2">
            <div className="flex items-center gap-1 flex-1 min-w-0">
              {(["7d", "30d", "mtd", "90d"] as RangePresetKey[]).map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => {
                    void applyPresetQuick(preset);
                  }}
                  className={`h-8 w-11 px-0 text-xs rounded-md border transition-colors ${
                    activePreset === preset
                      ? "cw-text border-[var(--cw-interactive-active-border)] bg-[var(--cw-interactive-active-bg)]"
                      : "cw-btn-muted border-[var(--cw-border)] hover:bg-[var(--cw-interactive-hover-bg)]"
                  }`}
                >
                  {preset.toUpperCase()}
                </button>
              ))}
            </div>
            <button type="button" onClick={applyRange} className="px-3 py-1.5 text-sm font-medium cw-btn shrink-0">
              {applyLabel}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AnalyticsPage() {
  const { t, lang } = useI18n();
  const router = useRouter();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<"auth" | "forbidden" | "sql" | "generic">("generic");

  const [funnel, setFunnel] = useState<FunnelData[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignData[]>([]);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);

  const [capiEvents, setCapiEvents] = useState<CapiEventStats[]>([]);
  const [capiOverview, setCapiOverview] = useState<CapiOverview | null>(null);
  const [funnelChain, setFunnelChain] = useState<FunnelChain | null>(null);
  const [kpis, setKpis] = useState<UnifiedKpis | null>(null);
  const [scrollDepth50, setScrollDepth50] = useState<number>(0);
  const [engagementInitiateAligned, setEngagementInitiateAligned] = useState<number>(0);
  const [scroll50ToCheckoutPercent, setScroll50ToCheckoutPercent] = useState<number>(0);
  const [engagementAlignedFrom, setEngagementAlignedFrom] = useState<string | null>(null);
  const [qualityGaps, setQualityGaps] = useState<QualityGaps | null>(null);
  const [qualitySeries, setQualitySeries] = useState<QualitySeriesRow[]>([]);
  const [freshness, setFreshness] = useState<AnalyticsFreshness | null>(null);
  const [funnelSources, setFunnelSources] = useState<AnalyticsResponse["funnel_sources"] | null>(null);

  const [marketingInputs, setMarketingInputs] = useState<MarketingInputs | null>(null);
  const [savingMarketing, setSavingMarketing] = useState(false);

  const [visibleFields, setVisibleFields] = useState<MetricFieldKey[]>(
    PRIMARY_METRIC_FIELDS.map((item) => item.key)
  );
  const [funnelUiSettings, setFunnelUiSettings] = useState<FunnelUiSettings>({
    mode: "payment",
    showLeadsCard: false,
    showAccessGrantedCard: false,
  });
  const [analyticsSection, setAnalyticsSection] = useState<
    "overview" | "funnel" | "campaigns" | "capi" | "inputs_quality"
  >("overview");

  const [draftReach, setDraftReach] = useState("0");
  const [draftImpressions, setDraftImpressions] = useState("0");
  const [draftClicks, setDraftClicks] = useState("0");
  const [draftSpend, setDraftSpend] = useState("0");
  const [draftPeriodLabel, setDraftPeriodLabel] = useState("");

  const [hovered, setHovered] = useState<{ day: FunnelData; x: number; idx: number } | null>(null);
  const [selectedBar, setSelectedBar] = useState<{ day: FunnelData; x: number; idx: number } | null>(null);
  const chartContainerRef = useRef<HTMLDivElement | null>(null);
  const chartScrollRef = useRef<HTMLDivElement | null>(null);
  const chartWrapRef = useRef<HTMLDivElement | null>(null);
  const lastBarRef = useRef<HTMLDivElement | null>(null);
  const [fromDate, setFromDate] = useState<string>(shiftedDate(29));
  const [toDate, setToDate] = useState<string>(formatDateLocal(new Date()));

  useEffect(() => {
    try {
      const raw = localStorage.getItem(METRIC_VISIBILITY_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;
      const valid = parsed.filter((value) =>
        METRIC_FIELDS.some((item) => item.key === value)
      ) as MetricFieldKey[];
      if (valid.length > 0) {
        setVisibleFields(valid);
      }
    } catch {
      // ignore malformed localStorage
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(METRIC_VISIBILITY_KEY, JSON.stringify(visibleFields));
    } catch {
      // ignore storage write failures
    }
  }, [visibleFields]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(FUNNEL_UI_SETTINGS_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<FunnelUiSettings>;
      const mode: FunnelMode = parsed.mode === "access" ? "access" : "payment";
      setFunnelUiSettings({
        mode,
        showLeadsCard: Boolean(parsed.showLeadsCard),
        showAccessGrantedCard: Boolean(parsed.showAccessGrantedCard),
      });
    } catch {
      // ignore malformed localStorage
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(FUNNEL_UI_SETTINGS_KEY, JSON.stringify(funnelUiSettings));
    } catch {
      // ignore storage write failures
    }
  }, [funnelUiSettings]);

  const fetchAnalytics = async (period?: { from: string; to: string }) => {
    const isInitialLoad = summary === null;
    if (isInitialLoad) {
      setLoading(true);
    } else {
      setIsRefreshing(true);
    }
    setError(null);
    setErrorType("generic");
    try {
      const {
        data: { session },
      } = await supabaseClient.auth.getSession();

      const query = new URLSearchParams();
      const activeFrom = period?.from ?? fromDate;
      const activeTo = period?.to ?? toDate;
      if (activeFrom) query.set("from", activeFrom);
      if (activeTo) query.set("to", activeTo);

      const res = await fetch(`/api/admin/analytics?${query.toString()}`, {
        headers: session ? { Authorization: `Bearer ${session.access_token}` } : {},
      });

      const data = (await res.json().catch(() => ({}))) as Partial<AnalyticsResponse> & {
        error?: string;
      };

      if (!res.ok) {
        if (res.status === 401) {
          setErrorType("auth");
          router.replace("/admin");
          return;
        }
        if (res.status === 403) {
          setErrorType("forbidden");
          throw new Error(t("analytics_error_forbidden"));
        }
        const apiError = data?.error || `Failed to load analytics (${res.status})`;
        const lower = apiError.toLowerCase();
        if (
          lower.includes("mv_funnel_daily") ||
          lower.includes("mv_revenue_by_campaign") ||
          lower.includes("analytics_marketing_inputs") ||
          lower.includes("analytics_meta_daily") ||
          lower.includes("mv_quality_gaps")
        ) {
          setErrorType("sql");
        }
        throw new Error(apiError);
      }

      if (data.period?.from && data.period?.to) {
        setFromDate(data.period.from);
        setToDate(data.period.to);
      }

      setFunnel(data.funnel ?? []);
      setCampaigns(data.campaigns ?? []);
      setSummary(data.summary ?? null);
      setCapiEvents(data.capi_events ?? []);
      setCapiOverview(data.capi_overview ?? null);
      setFunnelChain(data.funnel_chain ?? null);
      setKpis(data.kpis ?? null);
      setScrollDepth50(data.engagement?.scroll_depth_50 ?? 0);
      setEngagementInitiateAligned(data.engagement?.initiate_checkout_aligned ?? 0);
      setScroll50ToCheckoutPercent(data.engagement?.scroll50_to_checkout_percent ?? 0);
      setEngagementAlignedFrom(data.engagement?.aligned_from ?? null);
      setQualityGaps(data.quality_gaps ?? null);
      setQualitySeries(data.quality_series ?? []);
      setFreshness(data.freshness ?? null);
      setFunnelSources(data.funnel_sources ?? null);

      const inputs = data.marketing_inputs ?? null;
      setMarketingInputs(inputs);

      if (inputs) {
        setDraftReach(String(inputs.reach ?? 0));
        setDraftImpressions(String(inputs.impressions ?? 0));
        setDraftClicks(String(inputs.clicks ?? 0));
        setDraftSpend(String(inputs.spend ?? 0));
        setDraftPeriodLabel(inputs.period_label ?? "");
      }
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      if (isInitialLoad) {
        setLoading(false);
      } else {
        setIsRefreshing(false);
      }
    }
  };

  useEffect(() => {
    fetchAnalytics({ from: fromDate, to: toDate });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const funnelRangeKey = useMemo(() => {
    if (funnel.length === 0) return "empty";
    return `${funnel[0]?.date ?? ""}_${funnel[funnel.length - 1]?.date ?? ""}_${funnel.length}`;
  }, [funnel]);

  useEffect(() => {
    if (analyticsSection !== "overview") return;
    const el = chartScrollRef.current;
    if (!el) return;
    let delayedAlignId: number | null = null;
    const doAlign = () => {
      if (funnel.length <= 30) {
        el.scrollLeft = 0;
        return;
      }
      if (lastBarRef.current) {
        lastBarRef.current.scrollIntoView({ inline: "end", block: "nearest", behavior: "auto" });
      }
      // Force-right after layout rounding to avoid mobile settling on the left edge.
      el.scrollLeft = Math.max(0, el.scrollWidth - el.clientWidth);
    };
    requestAnimationFrame(() => {
      doAlign();
      delayedAlignId = window.setTimeout(doAlign, 180);
    });
    return () => {
      if (delayedAlignId !== null) {
        window.clearTimeout(delayedAlignId);
      }
    };
  }, [analyticsSection, funnel.length, funnelRangeKey]);

  const applyPeriod = async (nextRange?: DateRange) => {
    const rawFrom = nextRange?.from ?? fromDate;
    const rawTo = nextRange?.to ?? toDate;
    if (!isIsoDateInput(rawFrom) || !isIsoDateInput(rawTo)) {
      toast.error(t("analytics_invalid_period_format"));
      return;
    }
    const { from, to } = normalizeDateRange({ from: rawFrom, to: rawTo });
    setFromDate(from);
    setToDate(to);
    await fetchAnalytics({ from, to });
  };

  const eventByName = useMemo(() => {
    const map = new Map<CapiEventName, CapiEventStats>();
    for (const item of capiEvents) {
      map.set(item.event_name, item);
    }
    return map;
  }, [capiEvents]);

  const metricValues = useMemo(() => {
    const reach = marketingInputs?.reach ?? 0;
    const impressions = marketingInputs?.impressions ?? 0;
    const clicks = marketingInputs?.clicks ?? 0;
    const spend = marketingInputs?.spend ?? 0;
    const frequency = reach > 0 ? Number((impressions / reach).toFixed(2)) : 0;
    const currency = marketingInputs?.currency || "UAH";
    const revenue = summary?.totalRevenue ?? 0;

    return {
      values: {
        revenue,
        reach,
        impressions,
        frequency,
        clicks,
        spend,
        cpa: kpis?.cpa ?? 0,
        cpc: kpis?.cpc ?? 0,
        roas: kpis?.roas ?? 0,
        roi: kpis?.roi_percent ?? 0,
      } as Record<MetricFieldKey, number>,
      currency,
    };
  }, [marketingInputs, kpis, summary]);

  const renderMetricValue = (key: MetricFieldKey) => {
    const value = metricValues.values[key];
    if (
      key === "reach" ||
      key === "impressions" ||
      key === "clicks"
    ) {
      return value.toLocaleString();
    }

    if (key === "spend" || key === "cpa" || key === "cpc" || key === "revenue") {
      return `${value.toLocaleString()} ${metricValues.currency}`;
    }

    if (key === "roi") {
      return `${value.toLocaleString()}%`;
    }

    if (key === "roas" || key === "frequency") {
      return `${value.toLocaleString()}x`;
    }

    return value.toLocaleString();
  };

  const toggleField = (field: MetricFieldKey) => {
    setVisibleFields((prev) => {
      if (prev.includes(field)) {
        if (prev.length === 1) return prev;
        return prev.filter((item) => item !== field);
      }
      return [...prev, field];
    });
  };

  const saveMarketingInputs = async () => {
    try {
      setSavingMarketing(true);
      const {
        data: { session },
      } = await supabaseClient.auth.getSession();

      if (!session?.access_token) {
        throw new Error("No admin session");
      }

      const res = await fetch("/api/admin/analytics/marketing", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          reach: toNumberInput(draftReach),
          impressions: toNumberInput(draftImpressions),
          clicks: toNumberInput(draftClicks),
          spend: toNumberInput(draftSpend),
          currency: marketingInputs?.currency ?? "UAH",
          period_label: draftPeriodLabel.trim() || null,
        }),
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.error || `Failed to save (${res.status})`);
      }

      toast.success(t("analytics_marketing_saved"));
      await fetchAnalytics();
    } catch (err: unknown) {
      toast.error(`${t("common_error")}: ${getErrorMessage(err)}`);
    } finally {
      setSavingMarketing(false);
    }
  };

  const resolveCampaignSource = (sourceCampaign: string | null | undefined): string => {
    const raw = (sourceCampaign ?? "").trim();
    const normalized = raw.toLowerCase();

    if (!normalized || normalized === "organic" || normalized === "organic/direct") {
      return t("analytics_organic_direct");
    }

    if (normalized === "meta (no utm_campaign)") {
      return t("analytics_meta_no_utm");
    }

    if (/\{[^}]+\}/.test(raw)) {
      return `${t("analytics_campaign_placeholder_unresolved")}: ${raw}`;
    }

    if (/^\d{8,}$/.test(raw)) {
      return raw;
    }

    return raw;
  };

  const formatCampaignSpend = (value: number, currency: string | null | undefined): string => {
    const normalizedCurrency = (currency ?? "UAH").toUpperCase();
    const amount = Number(value ?? 0).toLocaleString(lang === "en" ? "en-US" : "ru-RU", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
    if (normalizedCurrency === "UAH") return `${amount} ₴`;
    return `${amount} ${normalizedCurrency}`;
  };

  if (error) {
    return (
      <div className="max-w-7xl mx-auto">
        <AdminErrorState
          title={t("analytics_load_error")}
          message={
            errorType === "sql"
              ? `${error}. ${t("analytics_sql_reminder")}`
              : error
          }
          action={(
            <button
              onClick={() => fetchAnalytics()}
              className="px-4 py-2 cw-btn cw-surface-2"
            >
              {t("analytics_retry")}
            </button>
          )}
        />
      </div>
    );
  }

  if (loading || !summary) {
    return (
      <div className="max-w-7xl mx-auto">
        <AdminLoadingState variant="spinner" text={t("analytics_loading")} className="cw-panel" />
      </div>
    );
  }

  const chartHeight = 150;
  const chartTopPadding = 14;
  const chartBottomPadding = 8;
  const chartAreaHeight = chartHeight + chartTopPadding + chartBottomPadding;
  const minBarWidth = 20;
  const barGapPx = 4;
  const yAxisWidthPx = 48;
  const maxRevenue = Math.max(...funnel.map((f) => f.total_revenue), 1);
  const { scaleMax, ticks } = buildNiceScale(maxRevenue, 4);
  const shouldEnableHorizontalChartScroll = funnel.length > 30;
  const minTrackWidthPx = Math.max(0, funnel.length * minBarWidth + Math.max(0, funnel.length - 1) * barGapPx);
  const barsTrackWidth = `max(100%, ${minTrackWidthPx}px)`;
  const yAxisLabelOffsetPx = -8;
  const tickLayout = [...ticks]
    .reverse()
    .map((tickValue) => {
      const ratio = scaleMax > 0 ? tickValue / scaleMax : 0;
      const yPx = chartTopPadding + (1 - ratio) * chartHeight;
      return {
        tickValue,
        yPx,
      };
    });
  const paymentConversion = funnelChain?.checkout_to_purchase_percent ?? 0;
  const accessConversion = funnelChain?.purchase_to_access_percent ?? 0;
  const primaryConversion =
    funnelUiSettings.mode === "payment" ? paymentConversion : accessConversion;
  const primaryConversionLabel =
    funnelUiSettings.mode === "payment"
      ? t("analytics_primary_conversion_payment")
      : t("analytics_primary_conversion_access");
  const dateLocale = lang === "en" ? "en-US" : "ru-RU";
  const uniqueImpressions = marketingInputs?.reach ?? 0;
  const viewContentFromReachPercent =
    uniqueImpressions > 0
      ? Number((((funnelChain?.view_content ?? 0) * 100) / uniqueImpressions).toFixed(2))
      : 0;
  const analyticsTabs = [
    { key: "overview", label: t("analytics_subtab_overview") },
    { key: "funnel", label: t("analytics_subtab_funnel") },
    { key: "campaigns", label: t("analytics_subtab_campaigns") },
    { key: "capi", label: t("analytics_subtab_capi") },
    { key: "inputs_quality", label: t("analytics_subtab_inputs_quality") },
  ] as const;
  const handleAnalyticsSectionChange = (key: string) => {
    flushSync(() => {
      setAnalyticsSection(
        key as "overview" | "funnel" | "campaigns" | "capi" | "inputs_quality"
      );
    });
  };
  const activeBar = hovered ?? selectedBar;
  return (
    <div className="max-w-7xl mx-auto space-y-4 md:space-y-6">
      <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-3 md:gap-4 cw-surface p-4 sm:p-5 md:p-6 rounded-2xl border cw-border cw-shadow">
        <div className="xl:max-w-sm">
          <h1 className="text-xl sm:text-2xl font-bold cw-text">{t("analytics_title")}</h1>
          <p className="text-xs cw-muted mt-2">
            {t("analytics_data_source")}:{" "}
            {marketingInputs?.source === "meta"
              ? t("analytics_data_source_meta")
              : t("analytics_data_source_manual")}
          </p>
          {marketingInputs?.updated_at ? (
            <p className="text-xs cw-muted mt-1">
              {t("analytics_last_update")}: {new Date(marketingInputs.updated_at).toLocaleString()}
            </p>
          ) : null}
        </div>
        <div className="w-full xl:w-auto flex flex-col gap-2">
          <DateRangePicker
            value={{ from: fromDate, to: toDate }}
            onApply={applyPeriod}
            applyLabel={lang === "en" ? "Apply" : "Применить"}
            locale={dateLocale}
          />
          {isRefreshing ? (
            <p className="text-[11px] cw-muted text-right">{t("analytics_loading")}</p>
          ) : null}
        </div>
      </div>

      <div className="pt-1">
        <AdminTabs
          items={[...analyticsTabs]}
          activeKey={analyticsSection}
          onChange={handleAnalyticsSectionChange}
        />
      </div>

      {analyticsSection === "inputs_quality" && (
        <div className="space-y-1">
          <h2 className="text-lg font-semibold cw-text">{t("analytics_inputs_title")}</h2>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => fetchAnalytics()}
              className="px-4 py-2 text-sm font-medium cw-btn"
            >
              {t("analytics_refresh")}
            </button>
          </div>
        </div>
      )}

      {analyticsSection === "inputs_quality" && (
        <div className="cw-panel p-4">
          <p className="text-sm font-medium cw-text mb-3">{t("analytics_edit_fields_hint")}</p>
          <div className="space-y-4">
            <div>
              <p className="text-xs cw-muted mb-2">{t("analytics_primary_fields")}</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {PRIMARY_METRIC_FIELDS.map((field) => (
                  <label key={field.key} className="flex items-center gap-2 text-sm cw-text">
                    <input
                      type="checkbox"
                      checked={visibleFields.includes(field.key)}
                      onChange={() => toggleField(field.key)}
                    />
                    {t(field.labelKey as never)}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs cw-muted mb-2">{t("analytics_optional_fields")}</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {OPTIONAL_METRIC_FIELDS.map((field) => (
                  <label key={field.key} className="flex items-center gap-2 text-sm cw-text">
                    <input
                      type="checkbox"
                      checked={visibleFields.includes(field.key)}
                      onChange={() => toggleField(field.key)}
                    />
                    {t(field.labelKey as never)}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs cw-muted mb-2">{t("analytics_funnel_settings")}</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3">
                <button
                  type="button"
                  className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                    funnelUiSettings.mode === "payment"
                      ? "cw-border cw-surface-2 cw-text"
                      : "cw-btn cw-btn-muted"
                  }`}
                  onClick={() =>
                    setFunnelUiSettings((prev) => ({
                      ...prev,
                      mode: "payment",
                    }))
                  }
                >
                  {t("analytics_mode_payment")}
                </button>
                <button
                  type="button"
                  className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                    funnelUiSettings.mode === "access"
                      ? "cw-border cw-surface-2 cw-text"
                      : "cw-btn cw-btn-muted"
                  }`}
                  onClick={() =>
                    setFunnelUiSettings((prev) => ({
                      ...prev,
                      mode: "access",
                    }))
                  }
                >
                  {t("analytics_mode_access")}
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <label className="flex items-center gap-2 text-sm cw-text">
                  <input
                    type="checkbox"
                    checked={funnelUiSettings.showLeadsCard}
                    onChange={() =>
                      setFunnelUiSettings((prev) => ({
                        ...prev,
                        showLeadsCard: !prev.showLeadsCard,
                      }))
                    }
                  />
                  {t("analytics_toggle_leads_card")}
                </label>
                <label className="flex items-center gap-2 text-sm cw-text">
                  <input
                    type="checkbox"
                    checked={funnelUiSettings.showAccessGrantedCard}
                    onChange={() =>
                      setFunnelUiSettings((prev) => ({
                        ...prev,
                        showAccessGrantedCard: !prev.showAccessGrantedCard,
                      }))
                    }
                  />
                  {t("analytics_toggle_access_card")}
                </label>
              </div>
            </div>
          </div>
        </div>
      )}

      {analyticsSection === "inputs_quality" && (
        <div className="cw-panel p-4 space-y-4">
          <p className="text-sm font-medium cw-text">{t("analytics_edit_inputs_hint")}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
            <label className="text-xs cw-muted flex flex-col gap-1">
              {t("analytics_metric_reach")}
              <input
                type="number"
                min={0}
                value={draftReach}
                onChange={(e) => setDraftReach(e.target.value)}
                className="cw-input px-3 py-2"
              />
            </label>
            <label className="text-xs cw-muted flex flex-col gap-1">
              {t("analytics_metric_impressions")}
              <input
                type="number"
                min={0}
                value={draftImpressions}
                onChange={(e) => setDraftImpressions(e.target.value)}
                className="cw-input px-3 py-2"
              />
            </label>
            <label className="text-xs cw-muted flex flex-col gap-1">
              {t("analytics_metric_clicks")}
              <input
                type="number"
                min={0}
                value={draftClicks}
                onChange={(e) => setDraftClicks(e.target.value)}
                className="cw-input px-3 py-2"
              />
            </label>
            <label className="text-xs cw-muted flex flex-col gap-1">
              {t("analytics_metric_spend")}
              <input
                type="number"
                min={0}
                step="0.01"
                value={draftSpend}
                onChange={(e) => setDraftSpend(e.target.value)}
                className="cw-input px-3 py-2"
              />
            </label>
            <label className="text-xs cw-muted flex flex-col gap-1">
              {t("analytics_period_label")}
              <input
                type="text"
                value={draftPeriodLabel}
                onChange={(e) => setDraftPeriodLabel(e.target.value)}
                placeholder={t("analytics_period_label_placeholder")}
                className="cw-input px-3 py-2"
              />
            </label>
          </div>
          <div className="flex justify-end">
            <button
              disabled={savingMarketing}
              onClick={saveMarketingInputs}
              className="px-4 py-2 text-sm font-medium cw-btn disabled:opacity-50"
            >
              {savingMarketing ? t("analytics_saving") : t("analytics_save")}
            </button>
          </div>
        </div>
      )}

      {analyticsSection === "inputs_quality" && (
        <div className="cw-panel p-4">
          <h3 className="text-sm font-semibold cw-text">{t("analytics_freshness_title")}</h3>
          <p className="text-xs cw-muted mt-1 mb-3">{t("analytics_freshness_note")}</p>
          {freshness ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {[
                { key: "local_view_content_last_at", label: t("analytics_freshness_local_view_content"), value: freshness.local_view_content_last_at, staleHours: 24 },
                { key: "local_scroll_depth_50_last_at", label: t("analytics_freshness_local_scroll50"), value: freshness.local_scroll_depth_50_last_at, staleHours: 24 },
                { key: "orders_created_last_at", label: t("analytics_freshness_orders_created"), value: freshness.orders_created_last_at, staleHours: 24 },
                { key: "orders_paid_last_at", label: t("analytics_freshness_orders_paid"), value: freshness.orders_paid_last_at, staleHours: 48 },
                { key: "capi_last_sent_at", label: t("analytics_freshness_capi"), value: freshness.capi_last_sent_at, staleHours: 24 },
                { key: "meta_last_synced_at", label: t("analytics_freshness_meta_sync"), value: freshness.meta_last_synced_at, staleHours: 24 },
                { key: "pixel_daily_last_synced_at", label: t("analytics_freshness_pixel_daily_sync"), value: freshness.pixel_daily_last_synced_at, staleHours: 24 },
              ].map((item) => {
                const status = freshnessStatus(item.value, item.staleHours);
                return (
                  <div key={item.key} className="cw-surface-2 border cw-border rounded-lg p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs cw-muted">{item.label}</p>
                      <span
                        className={`text-[11px] rounded-full px-2 py-0.5 border ${
                          status === "ok"
                            ? "cw-status-success-badge"
                            : status === "warn"
                              ? "cw-status-pending-badge"
                              : "cw-muted border cw-border"
                        }`}
                      >
                        {status === "ok"
                          ? t("analytics_freshness_status_ok")
                          : status === "warn"
                            ? t("analytics_freshness_status_stale")
                            : t("analytics_freshness_status_empty")}
                      </span>
                    </div>
                    <p className="text-sm cw-text mt-2">
                      {item.value ? new Date(item.value).toLocaleString() : "—"}
                    </p>
                  </div>
                );
              })}

              <div className="cw-surface-2 border cw-border rounded-lg p-3 md:col-span-2 lg:col-span-3">
                <p className="text-xs cw-muted">{t("analytics_freshness_quality_snapshot")}</p>
                <p className="text-sm cw-text mt-2">{freshness.quality_snapshot_date ?? "—"}</p>
              </div>
            </div>
          ) : (
            <div className="text-sm cw-muted">{t("analytics_freshness_no_data")}</div>
          )}
        </div>
      )}

      {analyticsSection === "inputs_quality" && (
        <div className="cw-panel p-4">
          <h3 className="text-sm font-semibold cw-text">{t("analytics_quality_title")}</h3>
          <p className="text-xs cw-muted mt-1 mb-3">{t("analytics_quality_note")}</p>
          {qualityGaps ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-2">
              <div className="cw-surface-2 border cw-border rounded-lg p-3">
                <p className="text-xs cw-muted">{t("analytics_quality_missing_fbclid")}</p>
                <p className="text-lg font-semibold cw-text mt-1">{qualityGaps.paid_missing_fbclid ?? 0}</p>
              </div>
              <div className="cw-surface-2 border cw-border rounded-lg p-3">
                <p className="text-xs cw-muted">{t("analytics_quality_missing_fbp")}</p>
                <p className="text-lg font-semibold cw-text mt-1">{qualityGaps.paid_missing_fbp ?? 0}</p>
              </div>
              <div className="cw-surface-2 border cw-border rounded-lg p-3">
                <p className="text-xs cw-muted">{t("analytics_quality_missing_page_url")}</p>
                <p className="text-lg font-semibold cw-text mt-1">{qualityGaps.paid_missing_page_url ?? 0}</p>
              </div>
              <div className="cw-surface-2 border cw-border rounded-lg p-3">
                <p className="text-xs cw-muted">{t("analytics_quality_missing_client_ip")}</p>
                <p className="text-lg font-semibold cw-text mt-1">{qualityGaps.paid_missing_client_ip ?? 0}</p>
              </div>
              <div className="cw-surface-2 border cw-border rounded-lg p-3">
                <p className="text-xs cw-muted">{t("analytics_quality_missing_client_ua")}</p>
                <p className="text-lg font-semibold cw-text mt-1">{qualityGaps.paid_missing_client_ua ?? 0}</p>
              </div>
            </div>
          ) : (
            <div className="text-sm cw-muted">{t("analytics_quality_no_data")}</div>
          )}

          <div className="mt-4">
            <h4 className="text-xs font-semibold cw-text uppercase tracking-wide mb-2">
              {t("analytics_quality_trend_title")}
            </h4>
            {qualitySeries.length > 0 ? (
              <div className="cw-surface rounded-xl border cw-border overflow-x-auto">
                <table className="min-w-full text-xs md:text-sm">
                  <thead className="cw-surface-2 border-b cw-border">
                    <tr>
                      <th className="px-3 py-2 text-left cw-muted uppercase">{t("analytics_col_date")}</th>
                      <th className="px-3 py-2 text-left cw-muted uppercase">{t("analytics_col_paid")}</th>
                      <th className="px-3 py-2 text-left cw-muted uppercase">{t("analytics_quality_missing_fbclid")}</th>
                      <th className="px-3 py-2 text-left cw-muted uppercase">{t("analytics_quality_missing_fbp")}</th>
                      <th className="px-3 py-2 text-left cw-muted uppercase">{t("analytics_quality_missing_page_url")}</th>
                      <th className="px-3 py-2 text-left cw-muted uppercase">{t("analytics_quality_missing_client_ip")}</th>
                      <th className="px-3 py-2 text-left cw-muted uppercase">{t("analytics_quality_missing_client_ua")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {qualitySeries.map((row) => (
                      <tr key={row.date} className="border-t cw-border">
                        <td className="px-3 py-2 cw-text">{row.date}</td>
                        <td className="px-3 py-2 cw-text">{row.paid_orders}</td>
                        <td className="px-3 py-2 cw-muted">{row.missing_fbclid}</td>
                        <td className="px-3 py-2 cw-muted">{row.missing_fbp}</td>
                        <td className="px-3 py-2 cw-muted">{row.missing_page_url}</td>
                        <td className="px-3 py-2 cw-muted">{row.missing_client_ip}</td>
                        <td className="px-3 py-2 cw-muted">{row.missing_client_ua}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-sm cw-muted">{t("analytics_quality_trend_no_data")}</div>
            )}
          </div>
        </div>
      )}

      {analyticsSection === "overview" && (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {funnelUiSettings.showLeadsCard ? (
          <div className="cw-surface p-4 sm:p-5 md:p-6 rounded-2xl border cw-border cw-shadow">
            <div className="text-sm font-medium cw-muted">{t("analytics_leads")}</div>
            <div className="text-3xl font-bold mt-2 cw-text">{summary.totalLeads}</div>
          </div>
        ) : null}
        <div className="cw-surface p-4 sm:p-5 md:p-6 rounded-2xl border cw-border cw-shadow">
          <div className="text-sm font-medium cw-muted">{t("analytics_purchases")}</div>
          <div className="text-3xl font-bold mt-2 cw-text">{summary.totalPaidOrders}</div>
        </div>
        <div className="cw-surface p-4 sm:p-5 md:p-6 rounded-2xl border cw-border cw-shadow">
          <div className="text-sm font-medium cw-muted">{primaryConversionLabel}</div>
          <div className="text-3xl font-bold mt-2 cw-text">{primaryConversion}%</div>
        </div>
        <div className="cw-surface p-4 sm:p-5 md:p-6 rounded-2xl border cw-border cw-shadow">
          <div className="text-sm font-medium cw-muted">{t("analytics_revenue_period")}</div>
          <div className="text-3xl font-bold mt-2 cw-text">{summary.totalRevenue.toLocaleString()} ₴</div>
        </div>
      </div>
      )}

      {analyticsSection === "overview" && (
      <div className="cw-panel p-4 sm:p-5 md:p-6 space-y-4 md:space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 md:gap-4">
          <div>
            <h2 className="text-lg font-semibold cw-text">{t("analytics_unified_kpi_title")}</h2>
            <p className="text-sm cw-muted">{t("analytics_unified_kpi_subtitle")}</p>
          </div>
          {marketingInputs?.updated_at ? (
            <span className="text-xs cw-muted">
              {t("analytics_last_update")}: {new Date(marketingInputs.updated_at).toLocaleString()}
            </span>
          ) : null}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {METRIC_FIELDS.filter((field) => visibleFields.includes(field.key)).map((field) => (
            <div key={field.key} className="cw-surface-2 border cw-border rounded-xl p-3">
              <div className="text-xs cw-muted">{t(field.labelKey as never)}</div>
              <div className="text-lg font-semibold cw-text mt-1">{renderMetricValue(field.key)}</div>
            </div>
          ))}
        </div>
      </div>
      )}

      {analyticsSection === "overview" && (
      <div className="cw-panel p-4 sm:p-5 md:p-6 space-y-4">
        <div>
          <h2 className="text-lg font-semibold cw-text">{t("analytics_engagement_title")}</h2>
          <p className="text-sm cw-muted">{t("analytics_engagement_subtitle")}</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="cw-surface-2 border cw-border rounded-xl p-4">
            <div className="text-xs cw-muted">{t("analytics_metric_scroll_depth_50")}</div>
            <div className="text-2xl font-bold cw-text mt-1">{scrollDepth50.toLocaleString()}</div>
          </div>
          <div className="cw-surface-2 border cw-border rounded-xl p-4">
            <div className="text-xs cw-muted">{t("analytics_scroll50_to_checkout_percent")}</div>
            <div className="text-2xl font-bold cw-text mt-1">{scroll50ToCheckoutPercent}%</div>
            <div className="text-xs cw-muted mt-1">
              {t("analytics_event_initiate_checkout")}: {engagementInitiateAligned}
              {engagementAlignedFrom ? ` • ${t("analytics_period_from")} ${new Date(engagementAlignedFrom).toLocaleDateString(dateLocale)}` : ""}
            </div>
          </div>
        </div>
      </div>
      )}

      {analyticsSection === "funnel" && (
        <div className="cw-panel p-4 sm:p-5 md:p-6 space-y-4">
          <h2 className="text-lg font-semibold cw-text">{t("analytics_chain_title")}</h2>
          {funnelSources ? (
            <div className="flex flex-wrap gap-2">
              {[
                { key: "unique_impressions", label: t("analytics_event_unique_impressions"), value: marketingInputs?.source === "meta" ? "meta_daily" : "manual_input" },
                { key: "view_content", label: t("analytics_event_view_content"), value: funnelSources.view_content },
                { key: "initiate_checkout", label: t("analytics_event_initiate_checkout"), value: funnelSources.initiate_checkout },
                { key: "purchase", label: t("analytics_event_purchase"), value: funnelSources.purchase },
                ...(funnelUiSettings.mode === "access" || funnelUiSettings.showAccessGrantedCard
                  ? [{ key: "access_granted", label: t("analytics_event_access_granted"), value: funnelSources.access_granted as "token_consumed" }]
                  : []),
              ].map((item) => (
                <span
                  key={item.key}
                  className="text-xs cw-muted border cw-border rounded-full px-2.5 py-1 cw-surface-2"
                >
                  {item.label}: {funnelSourceLabel(t, item.value as Parameters<typeof funnelSourceLabel>[1])}
                </span>
              ))}
            </div>
          ) : null}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="cw-surface-2 border cw-border rounded-xl p-4">
              <div className="text-xs cw-muted">{t("analytics_event_unique_impressions")}</div>
              <div className="text-2xl font-bold cw-text mt-1">{uniqueImpressions.toLocaleString()}</div>
              <div className="text-xs cw-muted mt-1">
                {t("analytics_chain_from_prev")}: —
              </div>
            </div>
            <div className="cw-surface-2 border cw-border rounded-xl p-4">
              <div className="text-xs cw-muted">{t("analytics_event_view_content")}</div>
              <div className="text-2xl font-bold cw-text mt-1">{funnelChain?.view_content ?? 0}</div>
              <div className="text-xs cw-muted mt-1">
                {t("analytics_chain_from_prev")}: {viewContentFromReachPercent}%
              </div>
            </div>
            <div className="cw-surface-2 border cw-border rounded-xl p-4">
              <div className="text-xs cw-muted">{t("analytics_event_initiate_checkout")}</div>
              <div className="text-2xl font-bold cw-text mt-1">{funnelChain?.initiate_checkout ?? 0}</div>
              <div className="text-xs cw-muted mt-1">
                {t("analytics_chain_from_prev")}: {funnelChain?.view_to_checkout_percent ?? 0}%
              </div>
            </div>
            <div className="cw-surface-2 border cw-border rounded-xl p-4">
              <div className="text-xs cw-muted">{t("analytics_event_purchase")}</div>
              <div className="text-2xl font-bold cw-text mt-1">{funnelChain?.purchase ?? 0}</div>
              <div className="text-xs cw-muted mt-1">
                {t("analytics_chain_from_prev")}: {funnelChain?.checkout_to_purchase_percent ?? 0}%
              </div>
            </div>
            {funnelUiSettings.showAccessGrantedCard || funnelUiSettings.mode === "access" ? (
              <div className="cw-surface-2 border cw-border rounded-xl p-4">
                <div className="text-xs cw-muted">{t("analytics_event_access_granted")}</div>
                <div className="text-2xl font-bold cw-text mt-1">{funnelChain?.access_granted ?? 0}</div>
                <div className="text-xs cw-muted mt-1">
                  {t("analytics_chain_from_prev")}: {funnelChain?.purchase_to_access_percent ?? 0}%
                </div>
              </div>
            ) : null}
          </div>

          <div className="cw-surface rounded-xl border cw-border overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="cw-surface-2 border-b cw-border">
                <tr>
                  <th className="px-4 py-2 text-left cw-muted uppercase text-xs">{t("analytics_col_event")}</th>
                  <th className="px-4 py-2 text-left cw-muted uppercase text-xs">{t("analytics_col_total")}</th>
                  <th className="px-4 py-2 text-left cw-muted uppercase text-xs">{t("analytics_col_conversion_from_prev")}</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t cw-border">
                  <td className="px-4 py-3 cw-text font-medium">{t("analytics_event_unique_impressions")}</td>
                  <td className="px-4 py-3 cw-text">{uniqueImpressions}</td>
                  <td className="px-4 py-3 cw-muted">—</td>
                </tr>
                <tr className="border-t cw-border">
                  <td className="px-4 py-3 cw-text font-medium">{t("analytics_event_view_content")}</td>
                  <td className="px-4 py-3 cw-text">{funnelChain?.view_content ?? 0}</td>
                  <td className="px-4 py-3 cw-muted">{viewContentFromReachPercent}%</td>
                </tr>
                <tr className="border-t cw-border">
                  <td className="px-4 py-3 cw-text font-medium">{t("analytics_event_initiate_checkout")}</td>
                  <td className="px-4 py-3 cw-text">{funnelChain?.initiate_checkout ?? 0}</td>
                  <td className="px-4 py-3 cw-muted">{funnelChain?.view_to_checkout_percent ?? 0}%</td>
                </tr>
                <tr className="border-t cw-border">
                  <td className="px-4 py-3 cw-text font-medium">{t("analytics_event_purchase")}</td>
                  <td className="px-4 py-3 cw-text">{funnelChain?.purchase ?? 0}</td>
                  <td className="px-4 py-3 cw-muted">{funnelChain?.checkout_to_purchase_percent ?? 0}%</td>
                </tr>
                {funnelUiSettings.mode === "access" || funnelUiSettings.showAccessGrantedCard ? (
                  <tr className="border-t cw-border">
                    <td className="px-4 py-3 cw-text font-medium">{t("analytics_event_access_granted")}</td>
                    <td className="px-4 py-3 cw-text">{funnelChain?.access_granted ?? 0}</td>
                    <td className="px-4 py-3 cw-muted">{funnelChain?.purchase_to_access_percent ?? 0}%</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {analyticsSection === "capi" && (
        <div className="cw-panel p-4 sm:p-5 md:p-6 space-y-4">
          <h2 className="text-lg font-semibold cw-text">{t("analytics_tab_capi")}</h2>
          <div className="cw-surface rounded-xl border cw-border overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="cw-surface-2 border-b cw-border">
                <tr>
                  <th className="px-4 py-2 text-left cw-muted uppercase text-xs">{t("analytics_col_event")}</th>
                  <th className="px-4 py-2 text-left cw-muted uppercase text-xs">{t("analytics_col_capi_success")}</th>
                  <th className="px-4 py-2 text-left cw-muted uppercase text-xs">{t("analytics_col_capi_pending")}</th>
                  <th className="px-4 py-2 text-left cw-muted uppercase text-xs">{t("analytics_col_capi_failed")}</th>
                  <th className="px-4 py-2 text-left cw-muted uppercase text-xs">{t("analytics_col_last_seen")}</th>
                </tr>
              </thead>
              <tbody>
                {(["ViewContent", "InitiateCheckout", "Purchase"] as CapiEventName[]).map((eventName) => {
                  const row = eventByName.get(eventName);
                  return (
                    <tr key={eventName} className="border-t cw-border">
                      <td className="px-4 py-3 cw-text font-medium">{t(metricEventLabelKey(eventName) as never)}</td>
                      <td className="px-4 py-3 cw-status-success-text">{row?.success ?? 0}</td>
                      <td className="px-4 py-3 cw-status-pending-text">{(row?.pending ?? 0) + (row?.running ?? 0)}</td>
                      <td className="px-4 py-3 cw-status-failed-text">{row?.failed ?? 0}</td>
                      <td className="px-4 py-3 cw-muted">
                        {row?.last_seen_at ? new Date(row.last_seen_at).toLocaleString() : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {capiOverview ? (
            <div className="text-sm cw-muted">
              {t("analytics_capi_overview")}: {t("analytics_col_total")} {capiOverview.total}, {t("analytics_col_capi_success")} {capiOverview.success}, {t("analytics_col_capi_pending")} {capiOverview.pending + capiOverview.running}, {t("analytics_col_capi_failed")} {capiOverview.failed}
            </div>
          ) : null}
        </div>
      )}

      {analyticsSection === "overview" && (
      <div className="cw-surface p-4 sm:p-5 md:p-6 rounded-2xl border cw-border cw-shadow">
        <h2 className="text-lg font-medium mb-4 md:mb-6 cw-text">{t("analytics_daily_revenue")}</h2>
        {funnel.length === 0 ? (
          <div className="text-center text-sm cw-muted py-10">{t("analytics_no_chart_data")}</div>
        ) : (
          <div ref={chartContainerRef} className="relative overflow-visible">
            {activeBar && (
              <div
                className="absolute z-40 -top-2 -translate-x-1/2 -translate-y-full border cw-border cw-shadow cw-text text-xs rounded-md py-1.5 px-2.5 whitespace-nowrap pointer-events-none"
                style={{
                  left: `${Math.max(64, Math.min(activeBar.x, (chartContainerRef.current?.clientWidth ?? activeBar.x) - 64))}px`,
                  backgroundColor: "var(--cw-surface-solid)",
                }}
              >
                <div className="font-semibold">{activeBar.day.date}</div>
                <div className="cw-muted">
                  {t("analytics_tooltip_revenue")}: <span className="cw-text">{activeBar.day.total_revenue} ₴</span>
                </div>
                <div className="cw-muted">
                  {t("analytics_tooltip_paid")}: <span className="cw-text">{activeBar.day.orders_paid}</span>
                </div>
              </div>
            )}
            <div className="flex items-end gap-2">
              <div
                className="relative shrink-0 pr-1"
                style={{
                  height: `${chartAreaHeight}px`,
                  width: `${yAxisWidthPx}px`,
                  backgroundColor: "transparent",
                }}
              >
                <svg className="absolute inset-0" width={yAxisWidthPx} height={chartAreaHeight} aria-hidden="true">
                  {tickLayout.map(({ tickValue, yPx }) => (
                    <text
                      key={tickValue}
                      x={yAxisWidthPx - 8}
                      y={yPx + yAxisLabelOffsetPx}
                      textAnchor="end"
                      dominantBaseline="middle"
                      alignmentBaseline="middle"
                      fill="var(--cw-muted)"
                      fontSize="11"
                      fontWeight="500"
                      style={{ fontVariantNumeric: "tabular-nums" }}
                    >
                      {formatCompactTick(tickValue, dateLocale)}
                    </text>
                  ))}
                </svg>
              </div>

              <div ref={chartScrollRef} className="flex-1 overflow-x-auto pb-2 custom-scrollbar">
                <div
                  ref={chartWrapRef}
                  className="relative min-w-0 pr-1"
                  style={{
                    height: `${chartAreaHeight}px`,
                    width: barsTrackWidth,
                    minWidth: barsTrackWidth,
                  }}
                >
                  <svg className="absolute inset-0 pointer-events-none" width="100%" height={chartAreaHeight} aria-hidden="true">
                    {tickLayout.map(({ tickValue, yPx }) => (
                      <line
                        key={tickValue}
                        x1="0"
                        x2="100%"
                        y1={yPx}
                        y2={yPx}
                        stroke="color-mix(in srgb, var(--cw-border) 22%, transparent)"
                        strokeWidth="1"
                        shapeRendering="crispEdges"
                      />
                    ))}
                  </svg>
                  <div
                    className="absolute left-0 right-1 flex items-end gap-1"
                    style={{
                      top: `${chartTopPadding}px`,
                      bottom: `${chartBottomPadding}px`,
                    }}
                  >
                    {funnel.map((day, idx) => {
                      const barHeight = Math.max((day.total_revenue / scaleMax) * chartHeight, 2);
                      const isLast = idx === funnel.length - 1;
                      return (
                        <div
                          key={idx}
                          ref={isLast ? lastBarRef : null}
                          className="relative flex h-full flex-col items-center justify-end"
                          style={{ flex: "1 1 0", minWidth: `${minBarWidth}px` }}
                          onMouseEnter={(e) => {
                            const containerRect = chartContainerRef.current?.getBoundingClientRect();
                            const x = containerRect ? e.clientX - containerRect.left : 0;
                            setHovered({ day, x, idx });
                          }}
                          onMouseMove={(e) => {
                            const containerRect = chartContainerRef.current?.getBoundingClientRect();
                            const x = containerRect ? e.clientX - containerRect.left : 0;
                            setHovered({ day, x, idx });
                          }}
                          onMouseLeave={() => setHovered(null)}
                          onPointerUp={(e) => {
                            const containerRect = chartContainerRef.current?.getBoundingClientRect();
                            const itemRect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                            const x = containerRect ? itemRect.left - containerRect.left + itemRect.width / 2 : 0;
                            setSelectedBar((prev) => (prev?.idx === idx ? null : { day, x, idx }));
                          }}
                        >
                          <div className="w-full cw-chart-bar rounded-t-sm" style={{ height: `${barHeight}px` }} />
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      )}

      {analyticsSection === "campaigns" && (
      <div className="cw-surface rounded-2xl border cw-border cw-shadow overflow-hidden">
        <div className="px-4 sm:px-5 md:px-6 py-4 md:py-5 border-b cw-border">
          <h2 className="text-lg font-medium cw-text">{t("analytics_campaign_breakdown")}</h2>
          <p className="text-sm cw-muted mt-1">{t("analytics_campaign_breakdown_subtitle")}</p>
        </div>
        {(() => {
          const showRevenueCol = visibleFields.includes("revenue");
          const showImpressionsCol = visibleFields.includes("impressions");
          const showReachCol = visibleFields.includes("reach");
          const showSpendCol = visibleFields.includes("spend");
          const totalColumns =
            4 + // source + view content + orders + paid
            (showRevenueCol ? 1 : 0) +
            (showImpressionsCol ? 1 : 0) +
            (showReachCol ? 1 : 0) +
            (showSpendCol ? 1 : 0);

          return (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y" style={{ borderColor: "var(--cw-border)" }}>
            <thead className="cw-surface-2">
              <tr>
                <th scope="col" className="px-4 md:px-6 py-3 text-left text-xs font-medium cw-muted uppercase tracking-wider">
                  {t("analytics_col_source_campaign")}
                </th>
                <th scope="col" className="px-4 md:px-6 py-3 text-left text-xs font-medium cw-muted uppercase tracking-wider">
                  {t("analytics_metric_view_content")}
                </th>
                <th scope="col" className="px-4 md:px-6 py-3 text-left text-xs font-medium cw-muted uppercase tracking-wider">
                  {t("analytics_col_orders")}
                </th>
                <th scope="col" className="px-4 md:px-6 py-3 text-left text-xs font-medium cw-muted uppercase tracking-wider">
                  {t("analytics_col_paid")}
                </th>
                {showRevenueCol ? (
                  <th scope="col" className="px-4 md:px-6 py-3 text-left text-xs font-medium cw-muted uppercase tracking-wider">
                    {t("analytics_col_revenue")}
                  </th>
                ) : null}
                {showSpendCol ? (
                  <th scope="col" className="px-4 md:px-6 py-3 text-left text-xs font-medium cw-muted uppercase tracking-wider">
                    {t("analytics_metric_spend")}
                  </th>
                ) : null}
                {showReachCol ? (
                  <th scope="col" className="px-4 md:px-6 py-3 text-left text-xs font-medium cw-muted uppercase tracking-wider">
                    {t("analytics_metric_reach")}
                  </th>
                ) : null}
                {showImpressionsCol ? (
                  <th scope="col" className="px-4 md:px-6 py-3 text-left text-xs font-medium cw-muted uppercase tracking-wider">
                    {t("analytics_metric_impressions")}
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody className="cw-surface" style={{ borderColor: "var(--cw-border)" }}>
              {campaigns.length === 0 ? (
                <tr>
                  <td colSpan={totalColumns} className="px-4 md:px-6 py-4 text-center text-sm cw-muted">
                    {t("analytics_no_campaign_data")}
                  </td>
                </tr>
              ) : (
                campaigns.map((camp, idx) => (
                  <tr key={idx} className="border-t cw-border cw-row-hover">
                    <td className="px-4 md:px-6 py-4 text-sm font-medium cw-text">
                      {resolveCampaignSource(camp.source_campaign)}
                    </td>
                    <td className="px-4 md:px-6 py-4 whitespace-nowrap text-sm cw-muted">{(camp.view_content ?? 0).toLocaleString()}</td>
                    <td className="px-4 md:px-6 py-4 whitespace-nowrap text-sm cw-muted">{camp.total_orders.toLocaleString()}</td>
                    <td className="px-4 md:px-6 py-4 whitespace-nowrap text-sm cw-muted">{camp.paid_orders.toLocaleString()}</td>
                    {showRevenueCol ? (
                      <td className="px-4 md:px-6 py-4 whitespace-nowrap text-sm font-medium cw-text">{camp.total_revenue.toLocaleString()} ₴</td>
                    ) : null}
                    {showSpendCol ? (
                      <td className="px-4 md:px-6 py-4 whitespace-nowrap text-sm cw-muted">{formatCampaignSpend(camp.spend ?? 0, camp.currency)}</td>
                    ) : null}
                    {showReachCol ? (
                      <td className="px-4 md:px-6 py-4 whitespace-nowrap text-sm cw-muted">{(camp.reach ?? 0).toLocaleString()}</td>
                    ) : null}
                    {showImpressionsCol ? (
                      <td className="px-4 md:px-6 py-4 whitespace-nowrap text-sm cw-muted">{(camp.impressions ?? 0).toLocaleString()}</td>
                    ) : null}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
          );
        })()}
      </div>
      )}
    </div>
  );
}
