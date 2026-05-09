import { adminClient } from "@/lib/auth/adminClient";
import { sendTelegramMessageWithToken } from "@/lib/tg";

const REPORTS_TIME_ZONE = process.env.ANALYTICS_REPORTS_TIMEZONE || "Europe/Kyiv";
const REPORTS_CHAT_ID = process.env.ANALYTICS_REPORTS_CHAT_ID;
const REPORTS_BOT_TOKEN = process.env.ANALYTICS_BOT_TOKEN;
const REPORTS_THREAD_ID_RAW = process.env.ANALYTICS_REPORTS_THREAD_ID;

type ReportKind = "daily" | "weekly" | "monthly";

type ProductTotals = {
  totalOrders: number;
  paidOrders: number;
  revenue: number;
};

type CampaignSummary = {
  campaign: string;
  spend: number;
  clicks: number;
  purchases: number;
  revenue: number;
};

type ReportWindow = {
  kind: ReportKind;
  from: string;
  to: string;
  fromTs: string;
  toExclusiveTs: string;
  label: string;
  eventKey: string;
};

function parseOptionalThreadId(raw: string | undefined): number | null {
  if (!raw) return null;
  const value = Number(raw);
  return Number.isInteger(value) && value > 0 ? value : null;
}

const REPORTS_THREAD_ID = parseOptionalThreadId(REPORTS_THREAD_ID_RAW);

function asFiniteNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function safeDivide(numerator: number, denominator: number): number {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) return 0;
  return numerator / denominator;
}

function formatCurrency(amount: number, currency = "UAH"): string {
  return new Intl.NumberFormat("uk-UA", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatNumber(amount: number): string {
  return new Intl.NumberFormat("uk-UA", {
    maximumFractionDigits: 2,
  }).format(amount);
}

function toPercent(numerator: number, denominator: number): string {
  return `${formatNumber(safeDivide(numerator * 100, denominator))}%`;
}

function isoDateFromParts(parts: { year: number; month: number; day: number }): string {
  const y = String(parts.year).padStart(4, "0");
  const m = String(parts.month).padStart(2, "0");
  const d = String(parts.day).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getIsoDateInTimeZone(date: Date, timeZone: string): string {
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

function shiftIsoDate(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

function parseShortOffsetToMs(raw: string): number | null {
  const m = raw.match(/([+-])(\d{1,2})(?::?(\d{2}))?$/);
  if (!m) return null;
  const sign = m[1] === "-" ? -1 : 1;
  const hh = Number(m[2] ?? "0");
  const mm = Number(m[3] ?? "0");
  return sign * (hh * 60 + mm) * 60 * 1000;
}

function getTimeZoneOffsetMs(date: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "shortOffset",
    year: "numeric",
  });
  const tzName = dtf.formatToParts(date).find((p) => p.type === "timeZoneName")?.value ?? "";
  return parseShortOffsetToMs(tzName) ?? 0;
}

function localMidnightUtcIso(isoDate: string, timeZone: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  let ts = Date.UTC(y, m - 1, d, 0, 0, 0, 0);
  for (let i = 0; i < 3; i += 1) {
    const offsetMs = getTimeZoneOffsetMs(new Date(ts), timeZone);
    const next = Date.UTC(y, m - 1, d, 0, 0, 0, 0) - offsetMs;
    if (next === ts) break;
    ts = next;
  }
  return new Date(ts).toISOString();
}

function productLabel(productCode: string | null | undefined): string {
  switch ((productCode ?? "").trim()) {
    case "short":
      return "Short Reboot";
    case "irem":
      return "IREM";
    case "consult":
      return "Consult";
    case "ideal-body":
      return "Ideal Body";
    case "platform":
      return "Platform";
    default:
      return "unknown";
  }
}

function escapeTelegramText(input: string): string {
  return input.replace(/[<>]/g, "");
}

function startOfMonth(isoDate: string): string {
  const [year, month] = isoDate.split("-").map(Number);
  return isoDateFromParts({ year, month, day: 1 });
}

function previousMonthStart(isoDate: string): string {
  const [yearRaw, monthRaw] = isoDate.split("-").map(Number);
  const year = monthRaw === 1 ? yearRaw - 1 : yearRaw;
  const month = monthRaw === 1 ? 12 : monthRaw - 1;
  return isoDateFromParts({ year, month, day: 1 });
}

function getKyivWeekday(isoDate: string): number {
  const [y, m, d] = isoDate.split("-").map(Number);
  const utcDay = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return utcDay === 0 ? 7 : utcDay;
}

function createReportWindow(kind: ReportKind, from: string, to: string, label: string): ReportWindow {
  return {
    kind,
    from,
    to,
    fromTs: localMidnightUtcIso(from, REPORTS_TIME_ZONE),
    toExclusiveTs: localMidnightUtcIso(shiftIsoDate(to, 1), REPORTS_TIME_ZONE),
    label,
    eventKey: `${kind}:${from}:${to}`,
  };
}

function reportWindowsForDate(now: Date): ReportWindow[] {
  const today = getIsoDateInTimeZone(now, REPORTS_TIME_ZONE);
  const windows: ReportWindow[] = [];

  const yesterday = shiftIsoDate(today, -1);
  windows.push(createReportWindow("daily", yesterday, yesterday, yesterday));

  if (getKyivWeekday(today) === 1) {
    const weekEnd = shiftIsoDate(today, -1);
    const weekStart = shiftIsoDate(weekEnd, -6);
    windows.push(createReportWindow("weekly", weekStart, weekEnd, `${weekStart} - ${weekEnd}`));
  }

  if (today.endsWith("-01")) {
    const monthStart = previousMonthStart(today);
    const monthEnd = shiftIsoDate(startOfMonth(today), -1);
    windows.push(createReportWindow("monthly", monthStart, monthEnd, `${monthStart} - ${monthEnd}`));
  }

  return windows;
}

async function reportEventExists(eventKey: string): Promise<boolean> {
  const db = adminClient();
  const { data, error } = await db
    .from("events")
    .select("id")
    .eq("type", "tg_report_sent")
    .contains("payload", { event_key: eventKey })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return Boolean(data?.id);
}

async function markReportSent(eventKey: string, payload: Record<string, unknown>): Promise<void> {
  const db = adminClient();
  const { error } = await db.from("events").insert({
    type: "tg_report_sent",
    order_ref: null,
    payload: {
      event_key: eventKey,
      ...payload,
    },
  });
  if (error) throw error;
}

async function saleNotificationSent(orderRef: string): Promise<boolean> {
  const db = adminClient();
  const { data, error } = await db
    .from("events")
    .select("id")
    .eq("type", "tg_sale_notification_sent")
    .eq("order_ref", orderRef)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return Boolean(data?.id);
}

async function markSaleNotificationSent(orderRef: string): Promise<void> {
  const db = adminClient();
  const { error } = await db.from("events").insert({
    type: "tg_sale_notification_sent",
    order_ref: orderRef,
    payload: {
      order_ref: orderRef,
      sent_at: new Date().toISOString(),
    },
  });
  if (error) throw error;
}

function resolveCampaignSource(row: { campaign?: unknown; page_url?: unknown }): string {
  if (typeof row.campaign === "string" && row.campaign.trim()) {
    return row.campaign.trim();
  }

  if (typeof row.page_url === "string" && row.page_url.trim()) {
    try {
      const url = new URL(row.page_url);
      const campaign = url.searchParams.get("utm_campaign");
      if (campaign && campaign.trim()) return campaign.trim();
    } catch {
      try {
        const url = new URL(row.page_url, "https://centerway.local");
        const campaign = url.searchParams.get("utm_campaign");
        if (campaign && campaign.trim()) return campaign.trim();
      } catch {
        return "organic/direct";
      }
    }
  }

  return "organic/direct";
}

function normalizeCampaignKey(input: string): string {
  return input
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

function topCampaignLines(campaigns: CampaignSummary[]): string[] {
  return campaigns.slice(0, 5).map((campaign, index) => {
    const roas = safeDivide(campaign.revenue, campaign.spend);
    return [
      `${index + 1}. ${escapeTelegramText(campaign.campaign)}`,
      `спенд ${formatCurrency(campaign.spend)}, клики ${formatNumber(campaign.clicks)}, покупки ${formatNumber(campaign.purchases)}, выручка ${formatCurrency(campaign.revenue)}, ROAS ${formatNumber(roas)}`,
    ].join(" — ");
  });
}

export async function sendConfirmedSaleTelegramReport(orderRef: string): Promise<{
  sent: boolean;
  reason?: string;
}> {
  if (!REPORTS_CHAT_ID) {
    return { sent: false, reason: "missing_reports_chat_id" };
  }
  if (!REPORTS_BOT_TOKEN) {
    return { sent: false, reason: "missing_reports_bot_token" };
  }

  const db = adminClient();
  if (await saleNotificationSent(orderRef)) {
    return { sent: false, reason: "already_sent" };
  }

  const { data: order, error } = await db
    .from("orders")
    .select("order_ref, product_code, amount, currency, campaign, page_url, created_at, status, customer_id")
    .eq("order_ref", orderRef)
    .maybeSingle();

  if (error) throw error;
  if (!order) return { sent: false, reason: "order_not_found" };
  if (order.status !== "paid" && order.status !== "completed") {
    return { sent: false, reason: "order_not_confirmed" };
  }

  let customerEmail: string | null = null;
  let customerPhone: string | null = null;
  if (order.customer_id) {
    const { data: customer, error: customerError } = await db
      .from("customers")
      .select("email, phone")
      .eq("id", order.customer_id)
      .maybeSingle();
    if (customerError) throw customerError;
    customerEmail = customer?.email ?? null;
    customerPhone = customer?.phone ?? null;
  }

  const campaign = resolveCampaignSource(order);
  const confirmedAt = order.created_at
    ? new Intl.DateTimeFormat("uk-UA", {
        timeZone: REPORTS_TIME_ZONE,
        dateStyle: "short",
        timeStyle: "short",
      }).format(new Date(order.created_at))
    : "невідомо";

  const text = [
    "Подтверждена продажа",
    `Продукт: ${productLabel(order.product_code)}`,
    `Сумма: ${formatCurrency(asFiniteNumber(order.amount), typeof order.currency === "string" && order.currency ? order.currency : "UAH")}`,
    `Order: ${order.order_ref}`,
    `Кампания: ${escapeTelegramText(campaign)}`,
    `Клиент: ${customerEmail || customerPhone || "контакт не найден"}`,
    `Время: ${confirmedAt}`,
  ].join("\n");

  await sendTelegramMessageWithToken(REPORTS_BOT_TOKEN, REPORTS_CHAT_ID, text, {
    messageThreadId: REPORTS_THREAD_ID,
  });
  await markSaleNotificationSent(orderRef);
  return { sent: true };
}

async function buildPeriodicReport(window: ReportWindow): Promise<string> {
  const db = adminClient();

  const [
    ordersResult,
    funnelResult,
    metaResult,
    campaignResult,
    qualityResult,
  ] = await Promise.all([
    db
      .from("orders")
      .select("product_code, status, amount, currency, campaign, page_url")
      .gte("created_at", window.fromTs)
      .lt("created_at", window.toExclusiveTs)
      .limit(50000),
    db
      .from("mv_funnel_daily")
      .select("date, leads_count, orders_created, orders_paid, total_revenue")
      .gte("date", window.from)
      .lte("date", window.to)
      .limit(366),
    db
      .from("analytics_meta_daily")
      .select("reach, impressions, clicks, spend, view_content, initiate_checkout, purchase, currency")
      .gte("day", window.from)
      .lte("day", window.to)
      .limit(366),
    db
      .from("analytics_meta_campaign_daily")
      .select("campaign_id, campaign_name, spend, clicks, purchase")
      .gte("day", window.from)
      .lte("day", window.to)
      .limit(5000),
    db
      .from("mv_quality_gaps")
      .select("snapshot_date, paid_missing_fbc, paid_missing_fbclid, paid_missing_fbp, paid_missing_page_url, paid_missing_client_ip, paid_missing_client_ua")
      .order("snapshot_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (ordersResult.error) throw ordersResult.error;
  if (funnelResult.error) throw funnelResult.error;
  if (metaResult.error) throw metaResult.error;
  if (campaignResult.error) throw campaignResult.error;
  if (qualityResult.error) throw qualityResult.error;

  const productTotals = new Map<string, ProductTotals>();
  const orderCampaignTotals = new Map<string, { revenue: number; paidOrders: number }>();
  let totalOrders = 0;
  let totalPaidOrders = 0;
  let totalRevenue = 0;
  let currency = "UAH";

  for (const row of ordersResult.data ?? []) {
    totalOrders += 1;
    const productCode = productLabel(typeof row.product_code === "string" ? row.product_code : null);
    const totals = productTotals.get(productCode) ?? { totalOrders: 0, paidOrders: 0, revenue: 0 };
    totals.totalOrders += 1;

    if (typeof row.currency === "string" && row.currency.trim()) {
      currency = row.currency.trim();
    }

    const isPaid = row.status === "paid" || row.status === "completed";
    if (isPaid) {
      totalPaidOrders += 1;
      const amount = asFiniteNumber(row.amount);
      totalRevenue += amount;
      totals.paidOrders += 1;
      totals.revenue += amount;

      const campaign = resolveCampaignSource(row);
      const campaignTotals = orderCampaignTotals.get(campaign) ?? { revenue: 0, paidOrders: 0 };
      campaignTotals.revenue += amount;
      campaignTotals.paidOrders += 1;
      orderCampaignTotals.set(campaign, campaignTotals);
    }

    productTotals.set(productCode, totals);
  }

  let leads = 0;
  let funnelOrdersCreated = 0;
  for (const row of funnelResult.data ?? []) {
    leads += asFiniteNumber(row.leads_count);
    funnelOrdersCreated += asFiniteNumber(row.orders_created);
  }

  const metaTotals = {
    reach: 0,
    impressions: 0,
    clicks: 0,
    spend: 0,
    viewContent: 0,
    initiateCheckout: 0,
    purchase: 0,
  };
  for (const row of metaResult.data ?? []) {
    metaTotals.reach += asFiniteNumber(row.reach);
    metaTotals.impressions += asFiniteNumber(row.impressions);
    metaTotals.clicks += asFiniteNumber(row.clicks);
    metaTotals.spend += asFiniteNumber(row.spend);
    metaTotals.viewContent += asFiniteNumber(row.view_content);
    metaTotals.initiateCheckout += asFiniteNumber(row.initiate_checkout);
    metaTotals.purchase += asFiniteNumber(row.purchase);
    if (typeof row.currency === "string" && row.currency.trim()) {
      currency = row.currency.trim();
    }
  }

  const campaignMap = new Map<string, CampaignSummary>();
  for (const row of campaignResult.data ?? []) {
    const campaignName =
      (typeof row.campaign_name === "string" && row.campaign_name.trim()) ||
      (typeof row.campaign_id === "string" && row.campaign_id.trim()) ||
      "meta campaign";
    const existing = campaignMap.get(campaignName) ?? {
      campaign: campaignName,
      spend: 0,
      clicks: 0,
      purchases: 0,
      revenue: 0,
    };
    existing.spend += asFiniteNumber(row.spend);
    existing.clicks += asFiniteNumber(row.clicks);
    existing.purchases += asFiniteNumber(row.purchase);
    campaignMap.set(campaignName, existing);
  }

  for (const [campaignName, totals] of orderCampaignTotals.entries()) {
    const normalized = normalizeCampaignKey(campaignName);
    for (const campaign of campaignMap.values()) {
      if (normalizeCampaignKey(campaign.campaign) === normalized) {
        campaign.revenue += totals.revenue;
      }
    }
  }

  const topCampaigns = Array.from(campaignMap.values())
    .sort((a, b) => {
      if (b.revenue !== a.revenue) return b.revenue - a.revenue;
      if (b.spend !== a.spend) return b.spend - a.spend;
      return b.purchases - a.purchases;
    });

  const topProducts = Array.from(productTotals.entries())
    .sort((a, b) => b[1].revenue - a[1].revenue)
    .slice(0, 3)
    .map(([product, totals]) => `${product}: ${totals.paidOrders} paid / ${formatCurrency(totals.revenue, currency)}`);

  const quality = qualityResult.data;
  const missingTrackingTotal = quality
    ? asFiniteNumber(quality.paid_missing_fbc) +
      asFiniteNumber(quality.paid_missing_fbclid) +
      asFiniteNumber(quality.paid_missing_fbp) +
      asFiniteNumber(quality.paid_missing_page_url) +
      asFiniteNumber(quality.paid_missing_client_ip) +
      asFiniteNumber(quality.paid_missing_client_ua)
    : 0;

  const lines = [
    `Отчёт ${window.kind}: ${window.label}`,
    "",
    "Продажи",
    `Подтверждено оплат: ${formatNumber(totalPaidOrders)} из ${formatNumber(totalOrders)}`,
    `Выручка: ${formatCurrency(totalRevenue, currency)}`,
    `Лиды: ${formatNumber(leads)}`,
    `CR lead → paid: ${toPercent(totalPaidOrders, leads)}`,
    "",
    "Реклама",
    `Spend: ${formatCurrency(metaTotals.spend, currency)}`,
    `Reach: ${formatNumber(metaTotals.reach)}`,
    `Impressions: ${formatNumber(metaTotals.impressions)}`,
    `Clicks: ${formatNumber(metaTotals.clicks)}`,
    `CTR: ${toPercent(metaTotals.clicks, metaTotals.impressions)}`,
    `CPC: ${formatCurrency(safeDivide(metaTotals.spend, metaTotals.clicks), currency)}`,
    `CPA: ${formatCurrency(safeDivide(metaTotals.spend, totalPaidOrders), currency)}`,
    `ROAS: ${formatNumber(safeDivide(totalRevenue, metaTotals.spend))}`,
    `ViewContent → Checkout: ${formatNumber(metaTotals.viewContent)} → ${formatNumber(metaTotals.initiateCheckout)}`,
    `Meta Purchase: ${formatNumber(metaTotals.purchase)}`,
    "",
    "Продукты",
    ...(topProducts.length > 0 ? topProducts : ["Нет подтверждённых продаж за период"]),
    "",
    "Топ кампаний",
    ...(topCampaigns.length > 0 ? topCampaignLines(topCampaigns) : ["Нет данных по кампаниям"]),
  ];

  if (funnelOrdersCreated > 0) {
    lines.push("", `Orders created: ${formatNumber(funnelOrdersCreated)}`);
  }

  if (quality) {
    lines.push(
      "",
      `Tracking gaps snapshot ${quality.snapshot_date}: ${formatNumber(missingTrackingTotal)}`
    );
  }

  return lines.join("\n");
}

export async function dispatchDueTelegramPeriodicReports(now = new Date()): Promise<{
  checked: number;
  sent: Array<{ kind: ReportKind; label: string }>;
  skipped: Array<{ kind: ReportKind; reason: string }>;
}> {
  if (!REPORTS_CHAT_ID) {
    return {
      checked: 0,
      sent: [],
      skipped: [{ kind: "daily", reason: "missing_reports_chat_id" }],
    };
  }
  if (!REPORTS_BOT_TOKEN) {
    return {
      checked: 0,
      sent: [],
      skipped: [{ kind: "daily", reason: "missing_reports_bot_token" }],
    };
  }

  const windows = reportWindowsForDate(now);
  const sent: Array<{ kind: ReportKind; label: string }> = [];
  const skipped: Array<{ kind: ReportKind; reason: string }> = [];

  for (const window of windows) {
    const exists = await reportEventExists(window.eventKey);
    if (exists) {
      skipped.push({ kind: window.kind, reason: "already_sent" });
      continue;
    }

    const text = await buildPeriodicReport(window);
    await sendTelegramMessageWithToken(REPORTS_BOT_TOKEN, REPORTS_CHAT_ID, text, {
      messageThreadId: REPORTS_THREAD_ID,
    });
    await markReportSent(window.eventKey, {
      report_kind: window.kind,
      range_from: window.from,
      range_to: window.to,
      label: window.label,
      sent_at: new Date().toISOString(),
      thread_id: REPORTS_THREAD_ID,
    });
    sent.push({ kind: window.kind, label: window.label });
  }

  return {
    checked: windows.length,
    sent,
    skipped,
  };
}
