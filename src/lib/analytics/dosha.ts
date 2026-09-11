import { unstable_cache } from "next/cache";

import { getIsoDateInTimeZone } from "@/lib/analytics/helpers";
import { ANALYTICS_TZ, type DateRange } from "@/lib/analytics/range";
import { adminClient } from "@/lib/auth/adminClient";
import type { DoshaResultType } from "@/lib/dosha/doshaTest";

/**
 * The dosha test's own dashboard: completions by type, CTA clicks, a daily
 * series. Out of its route on 2026-09-10; the route had carried a fourth
 * private copy of the date helpers and its own range parser to do this.
 */

const ALL_TYPES: DoshaResultType[] = ["vata", "pitta", "kapha", "vata_pitta", "pitta_kapha", "vata_kapha", "tridosha"];

export async function computeDoshaAnalytics(range: DateRange) {
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

    const dayKey =
      typeof row.completed_at === "string" ? getIsoDateInTimeZone(new Date(row.completed_at), ANALYTICS_TZ) : null;
    if (dayKey) {
      dailyCompletions.set(dayKey, (dailyCompletions.get(dayKey) ?? 0) + 1);
    }
  }

  const totalCompletions = (attempts ?? []).length;

  const completionsByTypeArr = ALL_TYPES.map((rt) => ({
    result_type: rt,
    count: completionsByType.get(rt) ?? 0,
    share_percent:
      totalCompletions > 0 ? Number((((completionsByType.get(rt) ?? 0) * 100) / totalCompletions).toFixed(1)) : 0,
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
      click_through_percent: completions > 0 ? Number(((totalClicks * 100) / completions).toFixed(1)) : 0,
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

  const ctaClickThroughPercent =
    totalCompletions > 0 ? Number(((totalCtaClicks * 100) / totalCompletions).toFixed(1)) : 0;

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

export function getCachedDoshaAnalytics(range: DateRange) {
  return unstable_cache(async () => computeDoshaAnalytics(range), ["admin-dosha-analytics-v1", range.from, range.to], {
    revalidate: 120,
  })();
}

export type DoshaAnalyticsPayload = Awaited<ReturnType<typeof computeDoshaAnalytics>>;
