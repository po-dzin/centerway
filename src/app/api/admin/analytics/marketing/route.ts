import { NextRequest, NextResponse } from "next/server";
import { adminClient } from "@/lib/auth/adminClient";
import {
  badRequestResponse,
  requireAdminSession,
  serverErrorResponse,
  unauthorizedResponse,
} from "@/lib/api/adminRoute";

type MarketingPatchBody = {
  reach?: unknown;
  impressions?: unknown;
  clicks?: unknown;
  spend?: unknown;
  currency?: unknown;
  period_label?: unknown;
};

function toNonNegativeNumber(value: unknown): number {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return 0;
  return num;
}

function toNullableString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function isMissingMarketingInputsTable(message: string | undefined): boolean {
  if (!message) return false;
  const lower = message.toLowerCase();
  return (
    lower.includes("analytics_marketing_inputs") &&
    (lower.includes("could not find the table") ||
      lower.includes("relation") ||
      lower.includes("does not exist"))
  );
}

export async function PATCH(req: NextRequest) {
  const session = await requireAdminSession(req);
  if (!session) return unauthorizedResponse();

  const body = (await req.json().catch(() => null)) as MarketingPatchBody | null;
  if (!body || typeof body !== "object") {
    return badRequestResponse("invalid_body");
  }

  const db = adminClient();

  // Hard admin-only write guard for this endpoint.
  const { data: roleRow, error: roleErr } = await db
    .from("user_roles")
    .select("role")
    .eq("user_id", session.user.id)
    .maybeSingle();

  if (roleErr) return serverErrorResponse(roleErr.message);
  if (!roleRow || roleRow.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const patch = {
    reach: toNonNegativeNumber(body.reach),
    impressions: toNonNegativeNumber(body.impressions),
    clicks: toNonNegativeNumber(body.clicks),
    spend: toNonNegativeNumber(body.spend),
    currency: toNullableString(body.currency) ?? "UAH",
    period_label: toNullableString(body.period_label),
    updated_by: session.user.id,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await db
    .from("analytics_marketing_inputs")
    .upsert({ id: 1, ...patch }, { onConflict: "id" })
    .select("reach, impressions, clicks, spend, currency, period_label, updated_at")
    .single();

  if (error) {
    if (isMissingMarketingInputsTable(error.message)) {
      return NextResponse.json(
        {
          error:
            "Missing table public.analytics_marketing_inputs. Run SQL migration: docs/migration/sql/2026-03-05_analytics_marketing_inputs.sql",
        },
        { status: 409 }
      );
    }
    return serverErrorResponse(error.message);
  }

  return NextResponse.json({ data });
}
