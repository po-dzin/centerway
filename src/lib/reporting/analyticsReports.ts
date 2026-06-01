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

type CampaignAliasSummary = {
  alias: string;
  campaign: string;
  spend: number;
  purchases: number;
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

function formatDateLabel(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Intl.DateTimeFormat("uk-UA", {
    timeZone: REPORTS_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function reportKindLabel(kind: ReportKind): string {
  switch (kind) {
    case "daily":
      return "Ежедневный отчёт";
    case "weekly":
      return "Еженедельный отчёт";
    case "monthly":
      return "Ежемесячный отчёт";
    default:
      return "Отчёт";
  }
}

function reportPeriodLabel(window: ReportWindow): string {
  if (window.from === window.to) {
    return formatDateLabel(window.from);
  }
  return `${formatDateLabel(window.from)} - ${formatDateLabel(window.to)}`;
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
    case "herbs":
      return "Herbs";
    case "platform":
      return "Платформа";
    default:
      return "Неизвестный продукт";
  }
}

function escapeTelegramText(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function bulletLine(label: string, value: string): string {
  return `• ${escapeTelegramText(label)}: ${escapeTelegramText(value)}`;
}

function boldHeading(text: string): string {
  return `<b>${escapeTelegramText(text)}</b>`;
}

function buildAttentionLines(input: {
  totalOrders: number;
  totalPaidOrders: number;
  spend: number;
  clicks: number;
  viewContent: number;
}): string[] {
  const lines: string[] = [];

  if (input.spend > 0 && input.totalOrders === 0) {
    lines.push("Есть расход, но созданных заказов за период нет.");
  }

  if (input.viewContent > 0 && input.totalOrders === 0) {
    lines.push("Есть просмотры страницы, но они не переходят в создание заказа.");
  }

  if (input.totalOrders > 0 && input.totalPaidOrders === 0) {
    lines.push("Заказы создаются, но подтверждённых оплат пока нет.");
  }

  if (input.totalPaidOrders > 0 && input.totalOrders > input.totalPaidOrders) {
    lines.push("Часть созданных заказов не дошла до подтверждённой оплаты.");
  }

  return lines;
}

function buildConclusionLine(input: {
  totalOrders: number;
  totalPaidOrders: number;
  totalRevenue: number;
  spend: number;
  roas: number;
  clicks: number;
  viewContent: number;
  topCampaign?: CampaignSummary;
}): string {
  if (input.totalPaidOrders > 0) {
    if (input.roas >= 1) {
      return `Создано ${formatNumber(input.totalOrders)} заказов, подтверждено ${formatNumber(input.totalPaidOrders)} оплат на ${formatCurrency(input.totalRevenue)}; ROAS ${formatNumber(input.roas)}.`;
    }
    if (input.totalOrders > input.totalPaidOrders) {
      return `Создано ${formatNumber(input.totalOrders)} заказов, подтверждено ${formatNumber(input.totalPaidOrders)} оплат на ${formatCurrency(input.totalRevenue)}.`;
    }
    return `Есть подтверждённые оплаты на ${formatCurrency(input.totalRevenue)}, но ROAS пока ${formatNumber(input.roas)}.`;
  }

  if (input.viewContent > 0 && input.totalOrders > 0) {
    return `Из ${formatNumber(input.viewContent)} просмотров страницы создано ${formatNumber(input.totalOrders)} заказов, но подтверждённых оплат пока нет.`;
  }

  if (input.spend > 0 && input.clicks > 0 && input.viewContent === 0) {
    return `Есть ${formatNumber(input.clicks)} кликов, но переход в просмотр страницы почти не сформирован.`;
  }

  if (input.spend > 0 && input.viewContent > 0 && input.totalOrders === 0) {
    return `Из ${formatNumber(input.viewContent)} просмотров страницы заказы пока не созданы.`;
  }

  if (input.spend > 0 && input.topCampaign && input.topCampaign.clicks > 0) {
    return `Расход ${formatCurrency(input.spend)}, подтверждённых оплат нет; лучший источник по кликам — ${input.topCampaign.campaign}.`;
  }

  if (input.spend > 0) {
    return `Расход составил ${formatCurrency(input.spend)}, но подтверждённых оплат за период нет.`;
  }

  return "За период нет значимого рекламного и платёжного сигнала.";
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
  return campaigns.slice(0, 3).map((campaign, index) => {
    const roas = safeDivide(campaign.revenue, campaign.spend);
    return [
      `${index + 1}. ${escapeTelegramText(campaign.campaign)}`,
      `расход ${formatCurrency(campaign.spend)}, клики ${formatNumber(campaign.clicks)}, покупки ${formatNumber(campaign.purchases)}, выручка ${formatCurrency(campaign.revenue)}, ROAS ${formatNumber(roas)}`,
    ].join(" — ");
  });
}

function resolveCampaignRevenueMatches(
  sourceCampaign: string,
  campaigns: CampaignSummary[]
): CampaignSummary[] {
  const normalized = normalizeCampaignKey(sourceCampaign);
  if (!normalized) return [];

  const exactMatches = campaigns.filter((campaign) => normalizeCampaignKey(campaign.campaign) === normalized);
  if (exactMatches.length > 0) return exactMatches;

  const fuzzyMatches = campaigns.filter((campaign) => {
    const target = normalizeCampaignKey(campaign.campaign);
    return Boolean(target) && (target.includes(normalized) || normalized.includes(target));
  });
  return fuzzyMatches;
}

function resolveCampaignAliasMatches(
  sourceCampaign: string,
  aliases: CampaignAliasSummary[]
): CampaignAliasSummary[] {
  const normalized = normalizeCampaignKey(sourceCampaign);
  if (!normalized) return [];

  const exactMatches = aliases.filter((alias) => normalizeCampaignKey(alias.alias) === normalized);
  if (exactMatches.length > 0) return exactMatches;

  const fuzzyMatches = aliases.filter((alias) => {
    const target = normalizeCampaignKey(alias.alias);
    return Boolean(target) && (target.includes(normalized) || normalized.includes(target));
  });
  return fuzzyMatches;
}
function allocateCampaignRevenue(
  sourceCampaign: string,
  totals: { revenue: number; paidOrders: number },
  campaigns: CampaignSummary[]
): void {
  const matches = resolveCampaignRevenueMatches(sourceCampaign, campaigns);
  if (matches.length === 0) return;

  if (matches.length === 1) {
    matches[0].revenue += totals.revenue;
    return;
  }

  // When order-side utm_campaign is broader than Meta breakdown rows,
  // distribute revenue across all matching rows by purchase count first.
  const purchaseWeight = matches.reduce((sum, campaign) => sum + Math.max(campaign.purchases, 0), 0);
  if (purchaseWeight > 0) {
    let remainingRevenue = totals.revenue;
    let remainingWeight = purchaseWeight;

    for (let index = 0; index < matches.length; index += 1) {
      const campaign = matches[index];
      const weight = Math.max(campaign.purchases, 0);
      if (weight <= 0) continue;

      const allocatedRevenue =
        index === matches.length - 1 || remainingWeight <= 0
          ? remainingRevenue
          : Math.round((remainingRevenue * weight) / remainingWeight);

      campaign.revenue += allocatedRevenue;
      remainingRevenue -= allocatedRevenue;
      remainingWeight -= weight;
    }
    return;
  }

  const spendWeight = matches.reduce((sum, campaign) => sum + Math.max(campaign.spend, 0), 0);
  if (spendWeight > 0) {
    let remainingRevenue = totals.revenue;
    let remainingWeight = spendWeight;

    for (let index = 0; index < matches.length; index += 1) {
      const campaign = matches[index];
      const weight = Math.max(campaign.spend, 0);
      if (weight <= 0) continue;

      const allocatedRevenue =
        index === matches.length - 1 || remainingWeight <= 0
          ? remainingRevenue
          : Math.round((remainingRevenue * weight) / remainingWeight);

      campaign.revenue += allocatedRevenue;
      remainingRevenue -= allocatedRevenue;
      remainingWeight -= weight;
    }
    return;
  }

  matches[0].revenue += totals.revenue;
}

function allocateCampaignRevenueByAliases(
  sourceCampaign: string,
  totals: { revenue: number; paidOrders: number },
  aliases: CampaignAliasSummary[],
  campaignLookup: Map<string, CampaignSummary>
): boolean {
  const matches = resolveCampaignAliasMatches(sourceCampaign, aliases);
  if (matches.length === 0) return false;

  const grouped = new Map<string, { spend: number; purchases: number }>();
  for (const match of matches) {
    const bucket = grouped.get(match.campaign) ?? { spend: 0, purchases: 0 };
    bucket.spend += Math.max(match.spend, 0);
    bucket.purchases += Math.max(match.purchases, 0);
    grouped.set(match.campaign, bucket);
  }

  const groups = Array.from(grouped.entries())
    .map(([campaign, stats]) => ({
      campaign,
      summary: campaignLookup.get(campaign) ?? null,
      spend: stats.spend,
      purchases: stats.purchases,
    }))
    .filter((item) => item.summary);

  if (groups.length === 0) return false;

  if (groups.length === 1) {
    groups[0].summary!.revenue += totals.revenue;
    return true;
  }

  const purchaseWeight = groups.reduce((sum, group) => sum + Math.max(group.purchases, 0), 0);
  if (purchaseWeight > 0) {
    let remainingRevenue = totals.revenue;
    let remainingWeight = purchaseWeight;

    for (let index = 0; index < groups.length; index += 1) {
      const group = groups[index];
      const weight = Math.max(group.purchases, 0);
      if (weight <= 0) continue;

      const allocatedRevenue =
        index === groups.length - 1 || remainingWeight <= 0
          ? remainingRevenue
          : Math.round((remainingRevenue * weight) / remainingWeight);

      group.summary!.revenue += allocatedRevenue;
      remainingRevenue -= allocatedRevenue;
      remainingWeight -= weight;
    }
    return true;
  }

  const spendWeight = groups.reduce((sum, group) => sum + Math.max(group.spend, 0), 0);
  if (spendWeight > 0) {
    let remainingRevenue = totals.revenue;
    let remainingWeight = spendWeight;

    for (let index = 0; index < groups.length; index += 1) {
      const group = groups[index];
      const weight = Math.max(group.spend, 0);
      if (weight <= 0) continue;

      const allocatedRevenue =
        index === groups.length - 1 || remainingWeight <= 0
          ? remainingRevenue
          : Math.round((remainingRevenue * weight) / remainingWeight);

      group.summary!.revenue += allocatedRevenue;
      remainingRevenue -= allocatedRevenue;
      remainingWeight -= weight;
    }
    return true;
  }

  groups[0].summary!.revenue += totals.revenue;
  return true;
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
    : "неизвестно";

  const text = [
    "Подтверждена продажа",
    `Продукт: ${productLabel(order.product_code)}`,
    `Сумма: ${formatCurrency(asFiniteNumber(order.amount), typeof order.currency === "string" && order.currency ? order.currency : "UAH")}`,
    `Заказ: ${order.order_ref}`,
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
    metaResult,
    campaignResult,
    adsetResult,
    adResult,
  ] = await Promise.all([
    db
      .from("orders")
      .select("product_code, status, amount, currency, campaign, page_url")
      .gte("created_at", window.fromTs)
      .lt("created_at", window.toExclusiveTs)
      .limit(50000),
    db
      .from("analytics_meta_daily")
      .select("reach, impressions, clicks, spend, view_content, currency")
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
      .from("analytics_meta_adset_daily")
      .select("campaign_name, adset_name, spend, purchase")
      .gte("day", window.from)
      .lte("day", window.to)
      .limit(10000),
    db
      .from("analytics_meta_ad_daily")
      .select("campaign_name, ad_name, spend, purchase")
      .gte("day", window.from)
      .lte("day", window.to)
      .limit(10000),
  ]);

  if (ordersResult.error) throw ordersResult.error;
  if (metaResult.error) throw metaResult.error;
  if (campaignResult.error) throw campaignResult.error;
  if (adsetResult.error) throw adsetResult.error;
  if (adResult.error) throw adResult.error;

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

  const metaTotals = {
    reach: 0,
    impressions: 0,
    clicks: 0,
    spend: 0,
    viewContent: 0,
  };
  for (const row of metaResult.data ?? []) {
    metaTotals.reach += asFiniteNumber(row.reach);
    metaTotals.impressions += asFiniteNumber(row.impressions);
    metaTotals.clicks += asFiniteNumber(row.clicks);
    metaTotals.spend += asFiniteNumber(row.spend);
    metaTotals.viewContent += asFiniteNumber(row.view_content);
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

  const campaignAliases = new Map<string, CampaignAliasSummary>();
  for (const row of adsetResult.data ?? []) {
    const alias =
      typeof row.adset_name === "string" && row.adset_name.trim()
        ? row.adset_name.trim()
        : "";
    const campaign =
      typeof row.campaign_name === "string" && row.campaign_name.trim()
        ? row.campaign_name.trim()
        : "";
    if (!alias || !campaign) continue;
    const key = `${campaign}::${alias}`;
    const existing = campaignAliases.get(key) ?? { alias, campaign, spend: 0, purchases: 0 };
    existing.spend += asFiniteNumber(row.spend);
    existing.purchases += asFiniteNumber(row.purchase);
    campaignAliases.set(key, existing);
  }
  for (const row of adResult.data ?? []) {
    const alias =
      typeof row.ad_name === "string" && row.ad_name.trim()
        ? row.ad_name.trim()
        : "";
    const campaign =
      typeof row.campaign_name === "string" && row.campaign_name.trim()
        ? row.campaign_name.trim()
        : "";
    if (!alias || !campaign) continue;
    const key = `${campaign}::${alias}`;
    const existing = campaignAliases.get(key) ?? { alias, campaign, spend: 0, purchases: 0 };
    existing.spend += asFiniteNumber(row.spend);
    existing.purchases += asFiniteNumber(row.purchase);
    campaignAliases.set(key, existing);
  }

  for (const [campaignName, totals] of orderCampaignTotals.entries()) {
    const campaignSummaries = Array.from(campaignMap.values());
    const allocatedDirectly = resolveCampaignRevenueMatches(campaignName, campaignSummaries).length > 0;
    if (allocatedDirectly) {
      allocateCampaignRevenue(campaignName, totals, campaignSummaries);
      continue;
    }

    const allocatedByAlias = allocateCampaignRevenueByAliases(
      campaignName,
      totals,
      Array.from(campaignAliases.values()),
      campaignMap
    );
    if (!allocatedByAlias) {
      continue;
    }
  }

  const topCampaigns = Array.from(campaignMap.values())
    .sort((a, b) => {
      if (b.revenue !== a.revenue) return b.revenue - a.revenue;
      if (b.spend !== a.spend) return b.spend - a.spend;
      return b.purchases - a.purchases;
    });

  const topProducts = Array.from(productTotals.entries())
    .filter(([, totals]) => totals.paidOrders > 0)
    .sort((a, b) => b[1].revenue - a[1].revenue)
    .slice(0, 3)
    .map(([product, totals]) => `${product}: ${totals.paidOrders} оплат / ${formatCurrency(totals.revenue, currency)}`);

  const roas = safeDivide(totalRevenue, metaTotals.spend);
  const attentionLines = buildAttentionLines({
    totalOrders,
    totalPaidOrders,
    spend: metaTotals.spend,
    clicks: metaTotals.clicks,
    viewContent: metaTotals.viewContent,
  });
  const conclusionLine = buildConclusionLine({
    totalOrders,
    totalPaidOrders,
    totalRevenue,
    spend: metaTotals.spend,
    roas,
    clicks: metaTotals.clicks,
    viewContent: metaTotals.viewContent,
    topCampaign: topCampaigns[0],
  });

  const lines = [
    boldHeading(`${reportKindLabel(window.kind)}: ${reportPeriodLabel(window)}`),
    "",
    boldHeading("Саммари"),
    bulletLine("Оплаты", `${formatNumber(totalPaidOrders)} из ${formatNumber(totalOrders)}`),
    bulletLine("Выручка", formatCurrency(totalRevenue, currency)),
    bulletLine(
      "Воронка",
      `просмотр страницы ${formatNumber(metaTotals.viewContent)} → создано заказов ${formatNumber(totalOrders)} → покупка ${formatNumber(totalPaidOrders)}`
    ),
    bulletLine("Конверсия просмотр → оплата", toPercent(totalPaidOrders, metaTotals.viewContent)),
    "",
    boldHeading("Реклама"),
    bulletLine("Расход", formatCurrency(metaTotals.spend, currency)),
    bulletLine("Охват", formatNumber(metaTotals.reach)),
    bulletLine("Клики", formatNumber(metaTotals.clicks)),
    bulletLine("CTR", toPercent(metaTotals.clicks, metaTotals.impressions)),
    bulletLine("Цена клика", formatCurrency(safeDivide(metaTotals.spend, metaTotals.clicks), currency)),
    bulletLine("Цена оплаты", formatCurrency(safeDivide(metaTotals.spend, totalPaidOrders), currency)),
    bulletLine("ROAS", formatNumber(roas)),
  ];

  if (window.kind === "daily") {
    lines.push("", boldHeading("Вывод"), `• ${escapeTelegramText(conclusionLine)}`);
    return lines.join("\n");
  }

  if (topProducts.length > 1) {
    lines.push("", boldHeading("Продукты"), ...topProducts.map((line) => `• ${escapeTelegramText(line)}`));
  }

  lines.push(
    "",
    boldHeading("Топ кампаний"),
    ...(topCampaigns.length > 0 ? topCampaignLines(topCampaigns).map((line) => `• ${escapeTelegramText(line)}`) : ["• Нет данных по кампаниям"])
  );

  if (attentionLines.length > 0) {
    lines.push("", boldHeading("Внимание"), ...attentionLines.map((line) => `• ${escapeTelegramText(line)}`));
  }

  lines.push("", boldHeading("Вывод"), `• ${escapeTelegramText(conclusionLine)}`);

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
      parseMode: "HTML",
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
