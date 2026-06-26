import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * Global rate limiting for public APIs (P0-A).
 *
 * Postgres-backed fixed-window limiter (see docs/migration/sql/2026-06-20_rate_limits.sql).
 * No new infra: shared across serverless instances via the existing Supabase DB.
 *
 * Fail-open by design: if the limiter errors (DB hiccup), we allow the request.
 * The limiter protects against abuse, not authn/authz — it must never block real
 * revenue/customers when the backing store is briefly unavailable.
 */

export type RateLimitRule = {
  /** stable name for the limited surface, e.g. "pay_start" */
  name: string;
  /** max requests allowed per window, per client key */
  limit: number;
  /** window length in seconds */
  windowSeconds: number;
};

export type RateLimitResult = {
  allowed: boolean;
  retryAfter: number;
  count: number;
};

/** Best-effort client IP from proxy headers. */
export function clientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

export async function enforceRateLimit(
  req: NextRequest,
  rule: RateLimitRule
): Promise<RateLimitResult> {
  const key = `${rule.name}:${clientIp(req)}`;
  try {
    const sb = supabaseAdmin();
    const { data, error } = await sb.rpc("check_rate_limit", {
      p_key: key,
      p_max: rule.limit,
      p_window_seconds: rule.windowSeconds,
    });
    if (error) {
      console.error("[rateLimit] rpc error, failing open:", error.message);
      return { allowed: true, retryAfter: 0, count: 0 };
    }
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return { allowed: true, retryAfter: 0, count: 0 };
    return {
      allowed: Boolean(row.allowed),
      retryAfter: Number(row.retry_after) || 0,
      count: Number(row.current_count) || 0,
    };
  } catch (err) {
    console.error("[rateLimit] unexpected error, failing open:", err);
    return { allowed: true, retryAfter: 0, count: 0 };
  }
}

/** Standard 429 response with Retry-After. */
export function tooManyRequests(retryAfter: number): NextResponse {
  return NextResponse.json(
    { ok: false, error: "rate_limited", retry_after: retryAfter },
    {
      status: 429,
      headers: { "Retry-After": String(Math.max(1, retryAfter)) },
    }
  );
}
