"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabaseClient } from "@/lib/supabaseClient";
import { useI18n } from "@/components/I18nProvider";
import { getErrorMessage } from "@/lib/errors";
import { useToast } from "@/components/ToastProvider";

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
  business_events: {
    view_content: number;
    initiate_checkout: number;
    purchase: number;
    access_granted: number;
  };
  marketing_inputs: MarketingInputs;
  quality_gaps?: QualityGaps | null;
  kpis: UnifiedKpis;
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

type DatePickerFieldProps = {
  value: string;
  onChange: (next: string) => void;
  locale: string;
  className?: string;
};

function DatePickerField({ value, onChange, locale, className = "" }: DatePickerFieldProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const selectedDate = useMemo(() => isoToDate(value), [value]);
  const [viewMonth, setViewMonth] = useState<Date>(() => selectedDate ?? new Date());

  useEffect(() => {
    if (selectedDate) {
      setViewMonth(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));
    }
  }, [selectedDate]);

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

  return (
    <div ref={rootRef} className={`relative w-full sm:w-[170px] md:w-[180px] ${className}`.trim()}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="cw-input h-9 px-3 text-sm flex items-center justify-between gap-2"
      >
        <span className={selectedDate ? "cw-text" : "cw-muted"}>
          {selectedDate
            ? selectedDate.toLocaleDateString(locale, { day: "2-digit", month: "2-digit", year: "numeric" })
            : "YYYY-MM-DD"}
        </span>
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="cw-muted">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      </button>

      {open && (
        <div className="absolute top-full right-0 sm:right-auto sm:left-0 mt-2 z-40 w-[280px] max-w-[calc(100vw-2rem)] cw-surface-solid border cw-border rounded-xl cw-shadow p-3">
          <div className="flex items-center justify-between mb-2">
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

          <div className="grid grid-cols-7 gap-1 mb-1">
            {dayNames.map((name) => (
              <div key={name} className="h-7 text-[11px] cw-muted flex items-center justify-center uppercase">
                {name}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {days.map((day) => {
              const iso = formatDateLocal(day);
              const isCurrentMonth = day.getMonth() === viewMonth.getMonth();
              const isSelected = value === iso;
              const isToday = iso === todayIso;
              const isFuture = iso > todayIso;
              return (
                <button
                  key={iso}
                  type="button"
                  disabled={isFuture}
                  onClick={() => {
                    if (isFuture) return;
                    onChange(iso);
                    setOpen(false);
                  }}
                  className={`h-8 rounded-md border text-xs transition-colors ${
                    isFuture
                      ? "border-transparent cw-muted opacity-35 cursor-not-allowed"
                      : ""
                  } ${
                    isSelected
                      ? "cw-text border-[var(--cw-interactive-active-border)] bg-[var(--cw-interactive-active-bg)] shadow-[var(--cw-interactive-active-shadow)]"
                      : isCurrentMonth
                        ? "border-transparent cw-text hover:bg-[var(--cw-interactive-hover-bg)]"
                        : "border-transparent cw-muted opacity-65 hover:bg-[var(--cw-interactive-hover-bg)]"
                  } ${isToday && !isSelected && !isFuture ? "border cw-border" : ""}`}
                >
                  {day.getDate()}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AnalyticsPage() {
  const { t, lang } = useI18n();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<"auth" | "forbidden" | "sql" | "generic">("generic");

  const [funnel, setFunnel] = useState<FunnelData[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignData[]>([]);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);

  const [capiEvents, setCapiEvents] = useState<CapiEventStats[]>([]);
  const [capiOverview, setCapiOverview] = useState<CapiOverview | null>(null);
  const [funnelChain, setFunnelChain] = useState<FunnelChain | null>(null);
  const [kpis, setKpis] = useState<UnifiedKpis | null>(null);
  const [qualityGaps, setQualityGaps] = useState<QualityGaps | null>(null);

  const [marketingInputs, setMarketingInputs] = useState<MarketingInputs | null>(null);
  const [savingMarketing, setSavingMarketing] = useState(false);
  const [syncingMeta, setSyncingMeta] = useState(false);

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

  const [hovered, setHovered] = useState<{ day: FunnelData; x: number } | null>(null);
  const chartWrapRef = useRef<HTMLDivElement | null>(null);
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
    setLoading(true);
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
          throw new Error(t("analytics_error_auth"));
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
      setQualityGaps(data.quality_gaps ?? null);

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
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics({ from: fromDate, to: toDate });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyPeriod = async () => {
    if (!isIsoDateInput(fromDate) || !isIsoDateInput(toDate)) {
      toast.error(t("analytics_invalid_period_format"));
      return;
    }
    const clampedFromDate = clampIsoToToday(fromDate);
    const clampedToDate = clampIsoToToday(toDate);
    const from = clampedFromDate <= clampedToDate ? clampedFromDate : clampedToDate;
    const to = clampedToDate >= clampedFromDate ? clampedToDate : clampedFromDate;
    setFromDate(from);
    setToDate(to);
    await fetchAnalytics({ from, to });
  };

  const applyPreset = async (days: number) => {
    const to = formatDateLocal(new Date());
    const from = shiftedDate(days - 1);
    setFromDate(from);
    setToDate(to);
    await fetchAnalytics({ from, to });
  };

  const applyMonthToDate = async () => {
    const now = new Date();
    const from = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-01`;
    const to = formatDateLocal(now);
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

  const syncMetaInsights = async () => {
    try {
      setSyncingMeta(true);
      const {
        data: { session },
      } = await supabaseClient.auth.getSession();

      if (!session?.access_token) {
        throw new Error("No admin session");
      }

      const res = await fetch("/api/admin/analytics/sync-meta", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({}),
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.error || `Failed to sync Meta (${res.status})`);
      }

      toast.success(t("analytics_meta_sync_success"));
      await fetchAnalytics();
    } catch (err: unknown) {
      toast.error(`${t("common_error")}: ${getErrorMessage(err)}`);
    } finally {
      setSyncingMeta(false);
    }
  };

  const campaignLabel = (sourceCampaign: string | null | undefined) => {
    const normalized = (sourceCampaign ?? "").trim().toLowerCase();
    if (!normalized || normalized === "organic" || normalized === "organic/direct") {
      return t("analytics_organic_direct");
    }
    if (normalized === "meta (no utm_campaign)") {
      return t("analytics_meta_no_utm");
    }
    return sourceCampaign;
  };

  if (error) {
    return (
      <div className="p-8 text-center cw-status-failed-text">
        <p>
          {t("analytics_load_error")}: {error}
        </p>
        {errorType === "sql" ? (
          <div className="mt-4 text-sm cw-muted">{t("analytics_sql_reminder")}</div>
        ) : null}
        <button
          onClick={() => fetchAnalytics()}
          className="mt-4 px-4 py-2 rounded border cw-border cw-surface-2 cw-text hover:bg-[var(--cw-accent-soft)] transition-colors"
        >
          {t("analytics_retry")}
        </button>
      </div>
    );
  }

  if (loading || !summary) {
    return <div className="p-8 text-center cw-muted animate-pulse">{t("analytics_loading")}</div>;
  }

  const chartHeight = 150;
  const maxRevenue = Math.max(...funnel.map((f) => f.total_revenue), 1);
  const paymentConversion = funnelChain?.checkout_to_purchase_percent ?? 0;
  const accessConversion = funnelChain?.purchase_to_access_percent ?? 0;
  const primaryConversion =
    funnelUiSettings.mode === "payment" ? paymentConversion : accessConversion;
  const primaryConversionLabel =
    funnelUiSettings.mode === "payment"
      ? t("analytics_primary_conversion_payment")
      : t("analytics_primary_conversion_access");
  const dateLocale = lang === "en" ? "en-US" : "ru-RU";

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-4 cw-surface p-6 rounded-2xl border cw-border cw-shadow">
        <div className="xl:max-w-sm">
          <h1 className="text-2xl font-bold cw-text">{t("analytics_title")}</h1>
          <p className="cw-muted text-sm mt-1">{t("analytics_subtitle")}</p>
          {marketingInputs?.period_label ? (
            <p className="text-xs cw-muted mt-1">
              {t("analytics_period_label")}: {marketingInputs.period_label}
            </p>
          ) : null}
          {marketingInputs?.source ? (
            <p className="text-xs cw-muted mt-1">
              {t("analytics_data_source")}: {marketingInputs.source === "meta" ? t("analytics_data_source_meta") : t("analytics_data_source_manual")}
            </p>
          ) : null}
        </div>
        <div className="w-full xl:w-auto flex flex-col gap-2">
          <div className="flex flex-col lg:flex-row lg:items-end gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs cw-muted shrink-0">{t("analytics_period_from")}</span>
              <DatePickerField
                value={fromDate}
                onChange={setFromDate}
                locale={dateLocale}
                className="sm:w-[150px] md:w-[160px]"
              />
              <span className="text-xs cw-muted shrink-0">{t("analytics_period_to")}</span>
              <DatePickerField
                value={toDate}
                onChange={setToDate}
                locale={dateLocale}
                className="sm:w-[150px] md:w-[160px]"
              />
            </div>
            <div className="flex flex-wrap items-center gap-1">
              <button
                type="button"
                onClick={() => applyPreset(7)}
                className="px-2 py-1 border cw-border rounded-md text-xs cw-muted hover:bg-[var(--cw-accent-soft)] transition-colors"
              >
                7d
              </button>
              <button
                type="button"
                onClick={() => applyPreset(30)}
                className="px-2 py-1 border cw-border rounded-md text-xs cw-muted hover:bg-[var(--cw-accent-soft)] transition-colors"
              >
                30d
              </button>
              <button
                type="button"
                onClick={applyMonthToDate}
                className="px-2 py-1 border cw-border rounded-md text-xs cw-muted hover:bg-[var(--cw-accent-soft)] transition-colors"
              >
                MTD
              </button>
              <button
                type="button"
                onClick={() => applyPreset(90)}
                className="px-2 py-1 border cw-border rounded-md text-xs cw-muted hover:bg-[var(--cw-accent-soft)] transition-colors"
              >
                90d
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={applyPeriod}
              className="w-full sm:w-auto px-3 py-2 border cw-border rounded-lg hover:bg-[var(--cw-accent-soft)] transition-colors text-sm font-medium cw-text"
            >
              {t("analytics_apply_period")}
            </button>
            <button
              onClick={syncMetaInsights}
              disabled={syncingMeta}
              className="w-full sm:w-auto px-3 py-2 border cw-border rounded-lg hover:bg-[var(--cw-accent-soft)] transition-colors text-sm font-medium cw-text disabled:opacity-50"
            >
              {syncingMeta ? t("analytics_meta_syncing") : t("analytics_meta_sync")}
            </button>
            <button
              onClick={() => fetchAnalytics()}
              className="w-full sm:w-auto px-4 py-2 border cw-border rounded-lg hover:bg-[var(--cw-accent-soft)] transition-colors text-sm font-medium cw-text"
            >
              {t("analytics_refresh")}
            </button>
          </div>
        </div>
      </div>

      <div className="cw-tabbar overflow-x-auto">
        <button
          type="button"
          className={`cw-tab ${analyticsSection === "overview" ? "cw-tab-active" : ""}`}
          onClick={() => setAnalyticsSection("overview")}
        >
          {t("analytics_subtab_overview")}
        </button>
        <button
          type="button"
          className={`cw-tab ${analyticsSection === "funnel" ? "cw-tab-active" : ""}`}
          onClick={() => setAnalyticsSection("funnel")}
        >
          {t("analytics_subtab_funnel")}
        </button>
        <button
          type="button"
          className={`cw-tab ${analyticsSection === "campaigns" ? "cw-tab-active" : ""}`}
          onClick={() => setAnalyticsSection("campaigns")}
        >
          {t("analytics_subtab_campaigns")}
        </button>
        <button
          type="button"
          className={`cw-tab ${analyticsSection === "capi" ? "cw-tab-active" : ""}`}
          onClick={() => setAnalyticsSection("capi")}
        >
          {t("analytics_subtab_capi")}
        </button>
        <button
          type="button"
          className={`cw-tab ${analyticsSection === "inputs_quality" ? "cw-tab-active" : ""}`}
          onClick={() => setAnalyticsSection("inputs_quality")}
        >
          {t("analytics_subtab_inputs_quality")}
        </button>
      </div>

      {analyticsSection === "inputs_quality" && (
        <div className="space-y-1">
          <h2 className="text-lg font-semibold cw-text">{t("analytics_inputs_title")}</h2>
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
                      : "cw-border cw-muted hover:bg-[var(--cw-accent-soft)]"
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
                      : "cw-border cw-muted hover:bg-[var(--cw-accent-soft)]"
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
              className="px-4 py-2 border cw-border rounded-lg hover:bg-[var(--cw-accent-soft)] transition-colors text-sm font-medium cw-text disabled:opacity-50"
            >
              {savingMarketing ? t("analytics_saving") : t("analytics_save")}
            </button>
          </div>
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
        </div>
      )}

      {analyticsSection === "overview" && (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {funnelUiSettings.showLeadsCard ? (
          <div className="cw-surface p-6 rounded-2xl border cw-border cw-shadow">
            <div className="text-sm font-medium cw-muted">{t("analytics_leads")}</div>
            <div className="text-3xl font-bold mt-2 cw-text">{summary.totalLeads}</div>
          </div>
        ) : null}
        <div className="cw-surface p-6 rounded-2xl border cw-border cw-shadow">
          <div className="text-sm font-medium cw-muted">{t("analytics_purchases")}</div>
          <div className="text-3xl font-bold mt-2 cw-text">{summary.totalPaidOrders}</div>
        </div>
        <div className="cw-surface p-6 rounded-2xl border cw-border cw-shadow">
          <div className="text-sm font-medium cw-muted">{primaryConversionLabel}</div>
          <div className="text-3xl font-bold mt-2 cw-text">{primaryConversion}%</div>
        </div>
        <div className="cw-surface p-6 rounded-2xl border cw-border cw-shadow">
          <div className="text-sm font-medium cw-muted">{t("analytics_revenue_all_time")}</div>
          <div className="text-3xl font-bold mt-2 cw-text">{summary.totalRevenue.toLocaleString()} ₴</div>
        </div>
      </div>
      )}

      {analyticsSection === "overview" && (
      <div className="cw-panel p-6 space-y-5">
        <div className="flex items-center justify-between gap-4">
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

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {METRIC_FIELDS.filter((field) => visibleFields.includes(field.key)).map((field) => (
            <div key={field.key} className="cw-surface-2 border cw-border rounded-xl p-3">
              <div className="text-xs cw-muted">{t(field.labelKey as never)}</div>
              <div className="text-lg font-semibold cw-text mt-1">{renderMetricValue(field.key)}</div>
            </div>
          ))}
        </div>
      </div>
      )}

      {analyticsSection === "funnel" && (
        <div className="cw-panel p-6 space-y-4">
          <h2 className="text-lg font-semibold cw-text">{t("analytics_chain_title")}</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="cw-surface-2 border cw-border rounded-xl p-4">
              <div className="text-xs cw-muted">{t("analytics_event_view_content")}</div>
              <div className="text-2xl font-bold cw-text mt-1">{funnelChain?.view_content ?? 0}</div>
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
                  <td className="px-4 py-3 cw-text font-medium">{t("analytics_event_view_content")}</td>
                  <td className="px-4 py-3 cw-text">{funnelChain?.view_content ?? 0}</td>
                  <td className="px-4 py-3 cw-muted">—</td>
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
        <div className="cw-panel p-6 space-y-4">
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
      <div className="cw-surface p-6 rounded-2xl border cw-border cw-shadow">
        <h2 className="text-lg font-medium mb-6 cw-text">{t("analytics_daily_revenue")}</h2>
        {funnel.length === 0 ? (
          <div className="text-center text-sm cw-muted py-10">{t("analytics_no_chart_data")}</div>
        ) : (
          <div ref={chartWrapRef} className="relative overflow-visible">
            {hovered && (
              <div
                className="absolute z-40 -top-2 -translate-x-1/2 -translate-y-full border cw-border cw-shadow cw-text text-xs rounded-md py-1.5 px-2.5 whitespace-nowrap pointer-events-none"
                style={{
                  left: `${Math.max(64, Math.min(hovered.x, (chartWrapRef.current?.clientWidth ?? hovered.x) - 64))}px`,
                  backgroundColor: "var(--cw-surface-solid)",
                }}
              >
                <div className="font-semibold">{hovered.day.date}</div>
                <div className="cw-muted">
                  {t("analytics_tooltip_revenue")}: <span className="cw-text">{hovered.day.total_revenue} ₴</span>
                </div>
                <div className="cw-muted">
                  {t("analytics_tooltip_leads")}: <span className="cw-text">{hovered.day.leads_count}</span>
                </div>
                <div className="cw-muted">
                  {t("analytics_tooltip_paid")}: <span className="cw-text">{hovered.day.orders_paid}</span>
                </div>
              </div>
            )}
            <div className="overflow-x-auto pb-2 custom-scrollbar">
              <div className="flex items-end gap-1 h-[150px] min-w-max">
                {funnel.map((day, idx) => {
                  const barHeight = Math.max((day.total_revenue / maxRevenue) * chartHeight, 2);
                  return (
                    <div
                      key={idx}
                      className="flex flex-col items-center flex-1 min-w-[20px] relative"
                      onMouseEnter={(e) => {
                        const wrapRect = chartWrapRef.current?.getBoundingClientRect();
                        const x = wrapRect ? e.clientX - wrapRect.left : 0;
                        setHovered({ day, x });
                      }}
                      onMouseMove={(e) => {
                        const wrapRect = chartWrapRef.current?.getBoundingClientRect();
                        const x = wrapRect ? e.clientX - wrapRect.left : 0;
                        setHovered({ day, x });
                      }}
                      onMouseLeave={() => setHovered(null)}
                    >
                      <div className="w-full cw-chart-bar rounded-t-sm" style={{ height: `${barHeight}px` }} />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
      )}

      {analyticsSection === "campaigns" && (
      <div className="cw-surface rounded-2xl border cw-border cw-shadow overflow-hidden">
        <div className="px-6 py-5 border-b cw-border">
          <h2 className="text-lg font-medium cw-text">{t("analytics_campaign_breakdown")}</h2>
          <p className="text-sm cw-muted mt-1">{t("analytics_campaign_breakdown_subtitle")}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y" style={{ borderColor: "var(--cw-border)" }}>
            <thead className="cw-surface-2">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium cw-muted uppercase tracking-wider">
                  {t("analytics_col_source_campaign")}
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium cw-muted uppercase tracking-wider">
                  {t("analytics_col_orders")}
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium cw-muted uppercase tracking-wider">
                  {t("analytics_col_paid")}
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium cw-muted uppercase tracking-wider">
                  {t("analytics_col_revenue")}
                </th>
              </tr>
            </thead>
            <tbody className="cw-surface" style={{ borderColor: "var(--cw-border)" }}>
              {campaigns.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-4 text-center text-sm cw-muted">
                    {t("analytics_no_campaign_data")}
                  </td>
                </tr>
              ) : (
                campaigns.map((camp, idx) => (
                  <tr key={idx} className="border-t cw-border hover:bg-[var(--cw-accent-soft)] transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium cw-text">
                      {campaignLabel(camp.source_campaign)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm cw-muted">{camp.total_orders}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm cw-muted">{camp.paid_orders}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium cw-text">{camp.total_revenue} ₴</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      )}
    </div>
  );
}
