import { NextRequest, NextResponse } from "next/server";
import {
  badRequestResponse,
  requireAdminSession,
  serverErrorResponse,
  unauthorizedResponse,
} from "@/lib/api/adminRoute";
import { adminClient } from "@/lib/auth/adminClient";
import { syncMetaAdsInsights } from "@/lib/tracking/metaAdsSync";

type SyncBody = {
  since?: unknown;
  until?: unknown;
};

const DEFAULT_COOLDOWN_SECONDS = 600;
const MANUAL_META_SYNC_ENABLED =
  process.env.ENABLE_MANUAL_META_SYNC === "1" ||
  process.env.ENABLE_MANUAL_META_SYNC === "true";

function asDateString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  return trimmed;
}

function asRateLimitMessage(retryAfterSeconds: number): string {
  return `Meta API rate limited. Retry after ${retryAfterSeconds}s`;
}

export async function POST(req: NextRequest) {
  if (!MANUAL_META_SYNC_ENABLED) {
    return NextResponse.json(
      {
        error: "manual_sync_disabled",
        message: "Manual Meta sync is disabled. Automatic daily cron sync is active.",
      },
      { status: 403 }
    );
  }

  const session = await requireAdminSession(req);
  if (!session) return unauthorizedResponse();

  const db = adminClient();
  const { data: roleRow, error: roleErr } = await db
    .from("user_roles")
    .select("role")
    .eq("user_id", session.user.id)
    .maybeSingle();

  if (roleErr) return serverErrorResponse(roleErr.message);
  if (!roleRow || roleRow.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as SyncBody;
  const since = asDateString(body.since);
  const until = asDateString(body.until);

  if (body.since !== undefined && !since) return badRequestResponse("invalid_since");
  if (body.until !== undefined && !until) return badRequestResponse("invalid_until");

  const cooldownSecondsRaw = Number(process.env.META_SYNC_COOLDOWN_SECONDS ?? DEFAULT_COOLDOWN_SECONDS);
  const cooldownSeconds = Number.isFinite(cooldownSecondsRaw) && cooldownSecondsRaw > 0
    ? Math.floor(cooldownSecondsRaw)
    : DEFAULT_COOLDOWN_SECONDS;

  const [metaLastSync, pixelLastSync] = await Promise.all([
    db
      .from("analytics_meta_daily")
      .select("synced_at")
      .order("synced_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    db
      .from("analytics_pixel_daily")
      .select("synced_at")
      .order("synced_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const latestSyncIso = [metaLastSync.data?.synced_at, pixelLastSync.data?.synced_at]
    .filter((v): v is string => typeof v === "string" && v.length > 0)
    .sort((a, b) => (a > b ? -1 : 1))[0] ?? null;
  const latestSyncMs = latestSyncIso ? Date.parse(latestSyncIso) : NaN;
  if (Number.isFinite(latestSyncMs)) {
    const nowMs = Date.now();
    const cooldownMs = cooldownSeconds * 1000;
    const elapsedMs = nowMs - latestSyncMs;
    if (elapsedMs < cooldownMs) {
      const retryAfterSeconds = Math.max(1, Math.ceil((cooldownMs - elapsedMs) / 1000));
      return NextResponse.json(
        {
          error: "sync_cooldown",
          message: asRateLimitMessage(retryAfterSeconds),
          retry_after_seconds: retryAfterSeconds,
        },
        { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
      );
    }
  }

  try {
    const result = await syncMetaAdsInsights({ since, until });
    return NextResponse.json({ ok: true, result });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    const lower = message.toLowerCase();
    const isRateLimited =
      lower.includes("too many calls") ||
      lower.includes("rate limit") ||
      lower.includes("rate-limiting") ||
      lower.includes("error code 4") ||
      lower.includes("code\":4") ||
      lower.includes("code\":17") ||
      lower.includes("code\":80004");
    if (isRateLimited) {
      const retryAfterSeconds = cooldownSeconds;
      return NextResponse.json(
        {
          error: "meta_rate_limited",
          message: asRateLimitMessage(retryAfterSeconds),
          retry_after_seconds: retryAfterSeconds,
          details: message,
        },
        { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
      );
    }
    return serverErrorResponse(message);
  }
}
