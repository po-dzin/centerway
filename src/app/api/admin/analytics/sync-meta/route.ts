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

function asDateString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  return trimmed;
}

export async function POST(req: NextRequest) {
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

  try {
    const result = await syncMetaAdsInsights({ since, until });
    return NextResponse.json({ ok: true, result });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return serverErrorResponse(message);
  }
}
