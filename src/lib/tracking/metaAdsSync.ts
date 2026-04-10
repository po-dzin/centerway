import { adminClient } from "@/lib/auth/adminClient";

type MetaInsightsAction = {
  action_type?: string;
  value?: string;
};

type MetaInsightsRow = {
  date_start?: string;
  date_stop?: string;
  campaign_id?: string;
  campaign_name?: string;
  spend?: string;
  reach?: string;
  impressions?: string;
  clicks?: string;
  actions?: MetaInsightsAction[];
  account_currency?: string;
};

type MetaInsightsResponse = {
  data?: MetaInsightsRow[];
  paging?: { next?: string };
  error?: { message?: string; type?: string; code?: number };
};

export type MetaSyncResult = {
  syncedRows: number;
  dayCount: number;
  since: string;
  until: string;
  accountId: string;
  campaignSyncedRows?: number;
  pixelSyncedRows?: number;
  pixelId?: string | null;
};

function toNumber(value: unknown): number {
  if (typeof value === "string") {
    const normalized = value.trim().replace(/\s+/g, "").replace(/,/g, "");
    const n = Number(normalized);
    return Number.isFinite(n) ? n : 0;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function normalizeAccountId(raw: string): string {
  const clean = raw.trim();
  if (!clean) return "";
  return clean.startsWith("act_") ? clean : `act_${clean}`;
}

function normalizePixelId(raw: string): string {
  return raw.trim();
}

function actionTypeTotals(actions: MetaInsightsAction[] | undefined): Map<string, number> {
  const totals = new Map<string, number>();
  if (!actions?.length) return totals;
  for (const action of actions) {
    const type = (action.action_type ?? "").trim().toLowerCase();
    if (!type) continue;
    totals.set(type, (totals.get(type) ?? 0) + toNumber(action.value));
  }
  return totals;
}

function pickActionValue(totals: Map<string, number>, candidateTypes: string[]): number {
  let max = 0;
  for (const actionType of candidateTypes) {
    const value = totals.get(actionType);
    if (value !== undefined && value > max) {
      max = value;
    }
  }
  return max;
}

function extractEventCounts(actions: MetaInsightsAction[] | undefined) {
  const totals = actionTypeTotals(actions);
  return {
    // Use explicit, prioritized action types to avoid over-counting from broad includes(...)
    // and to align closer with Ads Manager event columns.
    view_content: pickActionValue(totals, [
      "offsite_conversion.fb_pixel_view_content",
      "omni_view_content",
      "view_content",
    ]),
    initiate_checkout: pickActionValue(totals, [
      "offsite_conversion.fb_pixel_initiate_checkout",
      "omni_initiated_checkout",
      "omni_initiate_checkout",
      "initiate_checkout",
    ]),
    purchase: pickActionValue(totals, [
      "offsite_conversion.fb_pixel_purchase",
      "omni_purchase",
      "purchase",
    ]),
  };
}

function toIsoDate(input: Date): string {
  return input.toISOString().slice(0, 10);
}

function normalizePixelEventName(raw: string): "view_content" | "initiate_checkout" | "purchase" | null {
  const value = raw.trim().toLowerCase();
  if (!value) return null;
  if (value === "viewcontent" || value === "view_content" || value.includes("fb_pixel_view_content")) {
    return "view_content";
  }
  if (value === "initiatecheckout" || value === "initiate_checkout" || value.includes("fb_pixel_initiate_checkout")) {
    return "initiate_checkout";
  }
  if (value === "purchase" || value.includes("fb_pixel_purchase")) {
    return "purchase";
  }
  return null;
}

type PixelDayTotals = {
  view_content: number;
  initiate_checkout: number;
  purchase: number;
};

function parsePixelRowTotals(row: unknown): PixelDayTotals {
  const totals: PixelDayTotals = { view_content: 0, initiate_checkout: 0, purchase: 0 };
  if (!row || typeof row !== "object") return totals;
  const r = row as Record<string, unknown>;

  // Shape A: flattened event rows
  const rawName =
    (typeof r.event === "string" && r.event) ||
    (typeof r.event_name === "string" && r.event_name) ||
    (typeof r.action_type === "string" && r.action_type) ||
    null;
  if (rawName) {
    const key = normalizePixelEventName(rawName);
    if (key) {
      const valueCandidates = [r.total_count, r.total, r.value, r.count];
      const value =
        valueCandidates
          .map((candidate) => toNumber(candidate))
          .find((n) => Number.isFinite(n) && n >= 0) ?? 0;
      totals[key] += Math.max(0, Math.round(value));
    }
  }

  // Shape B: nested bucket row with data:[{value,count},...]
  const nested = Array.isArray(r.data) ? (r.data as unknown[]) : [];
  for (const item of nested) {
    if (!item || typeof item !== "object") continue;
    const entry = item as Record<string, unknown>;
    const nestedName = typeof entry.value === "string" ? entry.value : "";
    const key = normalizePixelEventName(nestedName);
    if (!key) continue;
    const count = toNumber(entry.count);
    totals[key] += Math.max(0, Math.round(count));
  }

  return totals;
}

async function syncPixelDailyStats(
  db: ReturnType<typeof adminClient>,
  options: { since: string; until: string; token: string; pixelId: string; apiVersion: string }
): Promise<number> {
  const nowIso = toIsoDate(new Date());
  const boundedUntil = options.until > nowIso ? nowIso : options.until;
  const params = new URLSearchParams({
    access_token: options.token,
    start_time: options.since,
    end_time: boundedUntil,
    aggregation: "event_total_counts",
    time_increment: "1",
    limit: "200",
  });
  let nextUrl = `https://graph.facebook.com/${options.apiVersion}/${options.pixelId}/stats?${params.toString()}`;
  const byDay = new Map<string, { totals: PixelDayTotals; rawRows: unknown[] }>();

  while (nextUrl) {
    const page = await fetchInsightsPage(nextUrl);
    const rows = Array.isArray(page?.data) ? page.data : [];
    for (const row of rows) {
      if (!row || typeof row !== "object") continue;
      const dayRaw = (row as Record<string, unknown>).start_time;
      const day = typeof dayRaw === "string" ? dayRaw.slice(0, 10) : null;
      if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;
      const existing = byDay.get(day) ?? {
        totals: { view_content: 0, initiate_checkout: 0, purchase: 0 },
        rawRows: [],
      };
      const parsed = parsePixelRowTotals(row);
      existing.totals.view_content += parsed.view_content;
      existing.totals.initiate_checkout += parsed.initiate_checkout;
      existing.totals.purchase += parsed.purchase;
      existing.rawRows.push(row);
      byDay.set(day, existing);
    }
    nextUrl = page?.paging?.next ?? "";
  }

  const upsertRows = Array.from(byDay.entries()).map(([day, payload]) => ({
    day,
    pixel_id: options.pixelId,
    view_content: payload.totals.view_content,
    initiate_checkout: payload.totals.initiate_checkout,
    purchase: payload.totals.purchase,
    raw: { rows: payload.rawRows },
    synced_at: new Date().toISOString(),
  }));

  if (upsertRows.length > 0) {
    const { error } = await db
      .from("analytics_pixel_daily")
      .upsert(upsertRows, { onConflict: "day,pixel_id" });
    if (error) {
      throw new Error(error.message);
    }
  }

  return upsertRows.length;
}

function resolveSyncWindow(sinceInput?: string | null, untilInput?: string | null) {
  const now = new Date();
  const defaultUntil = toIsoDate(now);
  const defaultDaysRaw = Number(process.env.META_SYNC_DEFAULT_DAYS ?? 2);
  const defaultDays = Number.isFinite(defaultDaysRaw) && defaultDaysRaw > 0
    ? Math.floor(defaultDaysRaw)
    : 2;
  const defaultSinceDate = new Date(now);
  defaultSinceDate.setDate(defaultSinceDate.getDate() - (defaultDays - 1));
  const defaultSince = toIsoDate(defaultSinceDate);

  const since = typeof sinceInput === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sinceInput)
    ? sinceInput
    : defaultSince;
  const until = typeof untilInput === "string" && /^\d{4}-\d{2}-\d{2}$/.test(untilInput)
    ? untilInput
    : defaultUntil;

  return { since, until };
}

async function fetchInsightsPage(url: string): Promise<MetaInsightsResponse> {
  const res = await fetch(url, { method: "GET", headers: { "Content-Type": "application/json" } });
  const json = (await res.json().catch(() => ({}))) as MetaInsightsResponse;
  if (!res.ok) {
    const msg = json?.error?.message || `Meta API error ${res.status}`;
    throw new Error(msg);
  }
  return json;
}

export async function syncMetaAdsInsights(options?: { since?: string | null; until?: string | null }): Promise<MetaSyncResult> {
  const token = process.env.META_ADS_ACCESS_TOKEN || process.env.META_ACCESS_TOKEN;
  const rawAccount = process.env.META_AD_ACCOUNT_ID;
  const rawPixelId = process.env.META_PIXEL_ID || process.env.META_AD_PIXEL_ID || process.env.META_PIXEL;
  const apiVersion = process.env.META_GRAPH_API_VERSION || "v21.0";

  if (!token) {
    throw new Error("META_ADS_ACCESS_TOKEN is not configured");
  }
  if (!rawAccount) {
    throw new Error("META_AD_ACCOUNT_ID is not configured");
  }

  const accountId = normalizeAccountId(rawAccount);
  if (!accountId) {
    throw new Error("META_AD_ACCOUNT_ID is invalid");
  }

  const { since, until } = resolveSyncWindow(options?.since, options?.until);

  const params = new URLSearchParams({
    access_token: token,
    level: "account",
    time_increment: "1",
    fields: "date_start,date_stop,spend,reach,impressions,clicks,actions,account_currency",
    time_range: JSON.stringify({ since, until }),
    limit: "200",
  });

  let nextUrl = `https://graph.facebook.com/${apiVersion}/${accountId}/insights?${params.toString()}`;
  const rows: MetaInsightsRow[] = [];

  while (nextUrl) {
    const page = await fetchInsightsPage(nextUrl);
    if (page.error?.message) {
      throw new Error(page.error.message);
    }
    if (Array.isArray(page.data)) {
      rows.push(...page.data);
    }
    nextUrl = page.paging?.next ?? "";
  }

  const db = adminClient();

  const upsertRows = rows
    .map((row) => {
      const day = row.date_start;
      if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
      const events = extractEventCounts(row.actions);
      return {
        day,
        account_id: accountId,
        reach: Math.round(toNumber(row.reach)),
        impressions: Math.round(toNumber(row.impressions)),
        clicks: Math.round(toNumber(row.clicks)),
        spend: toNumber(row.spend),
        currency: typeof row.account_currency === "string" && row.account_currency.trim() ? row.account_currency.trim() : "UAH",
        view_content: Math.round(events.view_content),
        initiate_checkout: Math.round(events.initiate_checkout),
        purchase: Math.round(events.purchase),
        raw: row,
        synced_at: new Date().toISOString(),
      };
    })
    .filter(Boolean) as Array<Record<string, unknown>>;

  if (upsertRows.length > 0) {
    const { error } = await db
      .from("analytics_meta_daily")
      .upsert(upsertRows, { onConflict: "day,account_id" });
    if (error) {
      throw new Error(error.message);
    }
  }

  const campaignParams = new URLSearchParams({
    access_token: token,
    level: "campaign",
    time_increment: "1",
    fields: "date_start,date_stop,campaign_id,campaign_name,spend,reach,impressions,clicks,actions,account_currency",
    time_range: JSON.stringify({ since, until }),
    limit: "500",
  });

  let campaignNextUrl = `https://graph.facebook.com/${apiVersion}/${accountId}/insights?${campaignParams.toString()}`;
  const campaignRows: MetaInsightsRow[] = [];

  while (campaignNextUrl) {
    const page = await fetchInsightsPage(campaignNextUrl);
    if (page.error?.message) {
      throw new Error(page.error.message);
    }
    if (Array.isArray(page.data)) {
      campaignRows.push(...page.data);
    }
    campaignNextUrl = page.paging?.next ?? "";
  }

  const campaignUpsertRows = campaignRows
    .map((row) => {
      const day = row.date_start;
      if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
      const campaignIdRaw = typeof row.campaign_id === "string" ? row.campaign_id.trim() : "";
      const campaignName = typeof row.campaign_name === "string" ? row.campaign_name.trim() : "";
      const campaignId = campaignIdRaw || campaignName;
      if (!campaignId) return null;
      const events = extractEventCounts(row.actions);
      return {
        day,
        account_id: accountId,
        campaign_id: campaignId,
        campaign_name: campaignName,
        reach: Math.round(toNumber(row.reach)),
        impressions: Math.round(toNumber(row.impressions)),
        clicks: Math.round(toNumber(row.clicks)),
        spend: toNumber(row.spend),
        currency: typeof row.account_currency === "string" && row.account_currency.trim() ? row.account_currency.trim() : "UAH",
        view_content: Math.round(events.view_content),
        initiate_checkout: Math.round(events.initiate_checkout),
        purchase: Math.round(events.purchase),
        raw: row,
        synced_at: new Date().toISOString(),
      };
    })
    .filter(Boolean) as Array<Record<string, unknown>>;

  let campaignSyncedRows = 0;
  if (campaignUpsertRows.length > 0) {
    const { error } = await db
      .from("analytics_meta_campaign_daily")
      .upsert(campaignUpsertRows, { onConflict: "day,account_id,campaign_id" });
    if (error) {
      const message = error.message.toLowerCase();
      const isMissingTable =
        message.includes("analytics_meta_campaign_daily") &&
        (message.includes("does not exist") || message.includes("relation") || message.includes("schema cache"));
      if (!isMissingTable) {
        throw new Error(error.message);
      }
      console.warn("Meta campaign sync skipped:", error.message);
    } else {
      campaignSyncedRows = campaignUpsertRows.length;
    }
  }

  let pixelSyncedRows = 0;
  const pixelId = rawPixelId ? normalizePixelId(rawPixelId) : null;
  if (pixelId) {
    pixelSyncedRows = await syncPixelDailyStats(db, {
      since,
      until,
      token,
      pixelId,
      apiVersion,
    });
  }

  return {
    syncedRows: upsertRows.length,
    dayCount: upsertRows.length,
    since,
    until,
    accountId,
    campaignSyncedRows,
    pixelSyncedRows,
    pixelId,
  };
}
