import { NextRequest, NextResponse } from "next/server";

import { adminClient } from "@/lib/auth/adminClient";
import { requireUserFromBearer } from "@/lib/auth/requireUser";
import { readBalancePayload } from "@/lib/balance/balanceAttempt";
import { BALANCE_TEST_SLUG } from "@/lib/balance/balanceTest";
import { DOSHA_TEST_SLUG } from "@/lib/dosha/doshaTest";

export const runtime = "nodejs";

/**
 * The reader's own last runs of one test, newest first (2026-10-02).
 *
 * For the line «Минулого разу, 12.09: …» on a full result: the cabinet and the
 * hub both sell retaking a test to see what changed, and nothing on the result
 * said what it was before. Signed-in only, the reader's own rows only, two at
 * most — the run on screen and the one before it.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ testSlug: string }> }) {
  const { testSlug } = await params;
  if (testSlug !== DOSHA_TEST_SLUG && testSlug !== BALANCE_TEST_SLUG) {
    return NextResponse.json({ error: "test_not_found" }, { status: 404 });
  }
  const user = await requireUserFromBearer(req.headers.get("authorization"));
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const db = adminClient();
  const { data, error } = await db
    .from("test_attempts")
    .select("id, completed_at, result_type, result_payload_json, test_definitions!inner(slug)")
    .eq("user_id", user.id)
    .eq("status", "completed")
    .eq("test_definitions.slug", testSlug)
    .order("completed_at", { ascending: false })
    .limit(2);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  type Run = { attemptId: string; completedAt: string | null; reading: string };
  const runs = (data ?? []).flatMap((row): Run[] => {
    if (testSlug === BALANCE_TEST_SLUG) {
      const reading = readBalancePayload(row.result_payload_json);
      return reading ? [{ attemptId: row.id, completedAt: row.completed_at, reading: reading.primary }] : [];
    }
    return row.result_type ? [{ attemptId: row.id, completedAt: row.completed_at, reading: row.result_type }] : [];
  });

  return NextResponse.json({ runs });
}
