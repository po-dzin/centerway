import { adminClient } from "@/lib/auth/adminClient";

type MetaInsightsAction = {
  action_type?: string;
  value?: string;
};

type MetaInsightsRow = {
  date_start?: string;
  date_stop?: string;
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
};

function toNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function normalizeAccountId(raw: string): string {
  const clean = raw.trim();
  if (!clean) return "";
  return clean.startsWith("act_") ? clean : `act_${clean}`;
}

function actionValue(actions: MetaInsightsAction[] | undefined, predicates: Array<(type: string) => boolean>): number {
  if (!actions?.length) return 0;
  let total = 0;
  for (const action of actions) {
    const type = (action.action_type ?? "").toLowerCase();
    if (!type) continue;
    if (predicates.some((predicate) => predicate(type))) {
      total += toNumber(action.value);
    }
  }
  return total;
}

function extractEventCounts(actions: MetaInsightsAction[] | undefined) {
  return {
    view_content: actionValue(actions, [
      (type) => type.includes("view_content"),
    ]),
    initiate_checkout: actionValue(actions, [
      (type) => type.includes("initiate_checkout"),
      (type) => type.includes("initiated_checkout"),
    ]),
    purchase: actionValue(actions, [
      (type) => type.includes("purchase"),
    ]),
  };
}

function toIsoDate(input: Date): string {
  return input.toISOString().slice(0, 10);
}

function resolveSyncWindow(sinceInput?: string | null, untilInput?: string | null) {
  const now = new Date();
  const defaultUntil = toIsoDate(now);
  const defaultSinceDate = new Date(now);
  defaultSinceDate.setDate(defaultSinceDate.getDate() - 30);
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

  return {
    syncedRows: upsertRows.length,
    dayCount: upsertRows.length,
    since,
    until,
    accountId,
  };
}
