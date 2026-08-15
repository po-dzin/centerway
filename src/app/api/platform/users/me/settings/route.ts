/**
 * POST /api/platform/users/me/settings — learner-controlled profile settings.
 *
 * Today it carries one field: the IANA timezone detected by the browser. Drip
 * ("день N") and reminders are computed in the learner's own calendar, so a
 * wrong zone silently shifts every unlock and every nudge
 * (docs/lms-research-2026-08-15.md §3A.4).
 *
 * The zone is VALIDATED server-side — a client may send anything.
 */

import { NextRequest, NextResponse } from "next/server";

import { adminClient } from "@/lib/auth/adminClient";
import { requireUserFromBearer } from "@/lib/auth/requireUser";
import { isValidTimeZone } from "@/lms-core";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const user = await requireUserFromBearer(req.headers.get("authorization"));
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { timezone?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const timezone = typeof body.timezone === "string" ? body.timezone.trim() : "";
  if (!timezone) return NextResponse.json({ error: "missing_timezone" }, { status: 400 });
  if (!isValidTimeZone(timezone)) {
    return NextResponse.json({ error: "invalid_timezone" }, { status: 400 });
  }

  const db = adminClient();
  const { error } = await db
    .from("platform_users")
    .update({ timezone })
    .eq("auth_user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, timezone });
}
