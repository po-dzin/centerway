import { NextRequest, NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { adminClient } from "@/lib/auth/adminClient";
import { requireAdminSession, serverErrorResponse, unauthorizedResponse } from "@/lib/api/adminRoute";
import type { DoshaResultType } from "@/lib/doshaTest";

export const runtime = "nodejs";

const TZ = "Europe/Kyiv";
const ALL_TYPES: DoshaResultType[] = ["vata", "pitta", "kapha", "vata_pitta", "pitta_kapha", "vata_kapha", "tridosha"];

function isIsoDate(v: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(v);
}

function getIsoDateInTz(date: Date): string {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = dtf.formatToParts(date);
  const y = parts.find((p) => p.type === "year")?.value ?? "0";
  const m = parts.find((p) => p.type === "month")?.value ?? "00";
  const d = parts.find((p) => p.type === "day")?.value ?? "00";
  return `${y}-${m}-${d}`;
}

function shiftIsoDate(iso: string, days: number): string {
  const [y, mo, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

function getTzOffsetMs(date: Date): number {
  const dtf = new Intl.DateTimeFormat("en-US", { timeZone: TZ, timeZoneName: "shortOffset", year: "numeric" });
  const raw = dtf.formatToParts(date).find((p) => p.type === "timeZoneName")?.value ?? "";
  const m = raw.match(/([+-])(\d{1,2})(?::?(\d{2}))?$/);
  if (!m) return 0;
  const sign = m[1] === "-" ? -1 : 1;
  return sign * (Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0)) * 60 * 1000;
}

function localMidnightUtc(iso: string): string {
  const [y, mo, d] = iso.split("-").map(Number);
  let ts = Date.UTC(y, mo - 1, d);
  for (let i = 0; i < 3; i++) {
    const off = getTzOffsetMs(new Date(ts));
    const next = Date.UTC(y, mo - 1, d) - off;
    if (next === ts) break;
    ts = next;
  }
  return new Date(ts).toISOString();
}

function buildRange(searchParams: URLSearchParams) {
  const todayIso = getIsoDateInTz(new Date());
  const rawFrom = searchParams.get("from");
  const rawTo = searchParams.get("to");
  const from = rawFrom && isIsoDate(rawFrom) ? rawFrom : shiftIsoDate(todayIso, -29);
  const to = rawTo && isIsoDate(rawTo) ? rawTo : todayIso;
  const f = from <= to ? from : to;
  const t = to >= from ? to : from;
  const clampedTo = t > todayIso ? todayIso : t;
  const clampedFrom = f > clampedTo ? clampedTo : f;
  return {
    from: clampedFrom,
    to: clampedTo,
    fromTs: localMidnightUtc(clampedFrom),
    toExclusiveTs: localMidnightUtc(shiftIsoDate(clampedTo, 1)),
  };
}

async function computeDoshaAnalytics(range: ReturnType<typeof buildRange>) {
  const db = adminClient();

  // 1. Completions from test_attempts
  const { data: attempts, error: attErr } = await db
    .from("test_attempts")
    .select("result_type, completed_at")
    .eq("status", "completed")
    .not("result_type", "is", null)
    .gte("completed_at", range.fromTs)
    .lt("completed_at", range.toExclusiveTs)
    .limit(50000);

  if (attErr) throw new Error(attErr.message);

  const completionsByType = new Map<string, number>();
  const dailyCompletions = new Map<string, number>();

  for (const row of attempts ?? []) {
    const rt = typeof row.result_type === "string" ? row.result_type : "unknown";
    completionsByType.set(rt, (completionsByType.get(rt) ?? 0) + 1);

    const dayKey = typeof row.completed_at === "string"
      ? getIsoDateInTz(new Date(row.completed_at))
      : null;
    if (dayKey) {
      dailyCompletions.set(dayKey, (dailyCompletions.get(dayKey) ?? 0) + 1);
    }
  }

  const totalCompletions = (attempts ?? []).length;

  const completionsByTypeArr = ALL_TYPES.map((rt) => ({
    result_type: rt,
    count: completionsByType.get(rt) ?? 0,
    share_percent: totalCompletions > 0
      ? Number(((completionsByType.get(rt) ?? 0) * 100 / totalCompletions).toFixed(1))
      : 0,
  })).sort((a, b) => b.count - a.count);

  // 2. CTA clicks from events table
  const { data: ctaEvents, error: ctaErr } = await db
    .from("events")
    .select("payload, created_at")
    .eq("type", "dosha_followup_clicked")
    .gte("created_at", range.fromTs)
    .lt("created_at", range.toExclusiveTs)
    .limit(50000);

  if (ctaErr) {
    console.warn("[dosha analytics] cta events read failed:", ctaErr.message);
  }

  const ctaByType = new Map<string, { primary: number; secondary: number }>();
  for (const row of ctaEvents ?? []) {
    const payload = row.payload as Record<string, unknown> | null;
    const rt = typeof payload?.resultType === "string" ? payload.resultType : "unknown";
    const target = typeof payload?.ctaTarget === "string" ? payload.ctaTarget : "";
    const entry = ctaByType.get(rt) ?? { primary: 0, secondary: 0 };
    if (target === "consult") {
      entry.primary += 1;
    } else {
      entry.secondary += 1;
    }
    ctaByType.set(rt, entry);
  }

  const totalCtaClicks = (ctaEvents ?? []).length;

  const ctaByTypeArr = ALL_TYPES.map((rt) => {
    const entry = ctaByType.get(rt) ?? { primary: 0, secondary: 0 };
    const completions = completionsByType.get(rt) ?? 0;
    const totalClicks = entry.primary + entry.secondary;
    return {
      result_type: rt,
      primary_clicks: entry.primary,
      secondary_clicks: entry.secondary,
      total_clicks: totalClicks,
      click_through_percent: completions > 0
        ? Number((totalClicks * 100 / completions).toFixed(1))
        : 0,
    };
  });

  // 3. Daily series with zero-fill
  const daily: Array<{ date: string; completions: number }> = [];
  const fromDate = new Date(`${range.from}T00:00:00.000Z`);
  const toDate = new Date(`${range.to}T00:00:00.000Z`);
  for (let cur = new Date(fromDate); cur <= toDate; cur.setUTCDate(cur.getUTCDate() + 1)) {
    const day = cur.toISOString().slice(0, 10);
    daily.push({ date: day, completions: dailyCompletions.get(day) ?? 0 });
  }

  // 4. Top type
  const topType = completionsByTypeArr[0]?.result_type ?? null;

  const ctaClickThroughPercent = totalCompletions > 0
    ? Number((totalCtaClicks * 100 / totalCompletions).toFixed(1))
    : 0;

  return {
    period: { from: range.from, to: range.to },
    total_completions: totalCompletions,
    total_cta_clicks: totalCtaClicks,
    cta_click_through_percent: ctaClickThroughPercent,
    top_type: topType,
    completions_by_type: completionsByTypeArr,
    cta_by_type: ctaByTypeArr,
    daily,
  };
}

function getCachedDoshaAnalytics(range: ReturnType<typeof buildRange>) {
  return unstable_cache(
    async () => computeDoshaAnalytics(range),
    ["admin-dosha-analytics-v1", range.from, range.to],
    { revalidate: 120 }
  )();
}

export async function GET(req: NextRequest) {
  const session = await requireAdminSession(req);
  if (!session) return unauthorizedResponse();

  const range = buildRange(req.nextUrl.searchParams);
  try {
    const payload = await getCachedDoshaAnalytics(range);
    return NextResponse.json(payload);
  } catch (error) {
    return serverErrorResponse(error instanceof Error ? error.message : String(error));
  }
}
