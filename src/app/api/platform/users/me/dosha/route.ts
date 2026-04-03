import { NextRequest, NextResponse } from "next/server";
import { adminClient } from "@/lib/auth/adminClient";
import { requireUserFromBearer } from "@/lib/auth/requireUser";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const user = await requireUserFromBearer(req.headers.get("authorization"));
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = adminClient();

  const { data: fromView, error: viewError } = await db
    .from("v_user_dosha_test_profile")
    .select("user_id, test_id, test_slug, attempt_id, result_type, score_vata, score_pitta, score_kapha, completed_at, version")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!viewError && fromView) {
    return NextResponse.json({
      userId: user.id,
      source: "view",
      profile: {
        attemptId: fromView.attempt_id,
        testId: fromView.test_id,
        testSlug: fromView.test_slug,
        testVersion: fromView.version,
        resultType: fromView.result_type,
        scores: {
          vata: fromView.score_vata,
          pitta: fromView.score_pitta,
          kapha: fromView.score_kapha,
        },
        completedAt: fromView.completed_at,
        version: fromView.version,
      },
    });
  }

  // Fallback for environments where view is not yet applied.
  const { data: attempt, error: fallbackError } = await db
    .from("test_attempts")
    .select("id, test_id, result_type, score_vata, score_pitta, score_kapha, completed_at, version")
    .eq("user_id", user.id)
    .eq("status", "completed")
    .not("result_type", "is", null)
    .order("completed_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (fallbackError) {
    return NextResponse.json({ error: fallbackError.message }, { status: 500 });
  }

  if (!attempt) {
    return NextResponse.json({ userId: user.id, profile: null });
  }

  return NextResponse.json({
    userId: user.id,
    source: "test_attempts_fallback",
    profile: {
      attemptId: attempt.id,
      testId: attempt.test_id,
      testSlug: "dosha-test",
      testVersion: attempt.version,
      resultType: attempt.result_type,
      scores: {
        vata: attempt.score_vata,
        pitta: attempt.score_pitta,
        kapha: attempt.score_kapha,
      },
      completedAt: attempt.completed_at,
      version: attempt.version,
    },
  });
}
