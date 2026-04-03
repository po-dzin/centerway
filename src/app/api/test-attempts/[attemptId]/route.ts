import { NextResponse } from "next/server";
import { adminClient } from "@/lib/auth/adminClient";
import {
  ensureDoshaTestSeed,
  loadAnswersForTestAttempt,
  loadTestAttempt,
  loadTestDefinitionBySlug,
} from "@/lib/doshaTestRepo";
import { DOSHA_TEST_SLUG } from "@/lib/doshaTest";

export const runtime = "nodejs";

export async function GET(
  _: Request,
  { params }: { params: Promise<{ attemptId: string }> }
) {
  const { attemptId } = await params;

  try {
    const db = adminClient();
    await ensureDoshaTestSeed(db);

    const attempt = await loadTestAttempt(db, attemptId);
    if (!attempt) {
      return NextResponse.json({ error: "attempt_not_found" }, { status: 404 });
    }

    const test = await loadTestDefinitionBySlug(db, DOSHA_TEST_SLUG);
    if (!test || test.id !== attempt.test_id) {
      return NextResponse.json({ error: "test_not_found" }, { status: 404 });
    }

    const answers = await loadAnswersForTestAttempt(db, attempt.id);

    return NextResponse.json({
      attemptId: attempt.id,
      status: attempt.status,
      completedAt: attempt.completed_at,
      currentQuestionIndex: attempt.current_question_index,
      totalQuestions: test.questions.length,
      answeredCount: answers.length,
      answers,
      scores: {
        vata: attempt.score_vata,
        pitta: attempt.score_pitta,
        kapha: attempt.score_kapha,
      },
      resultType: attempt.result_type,
      resultPayload: attempt.result_payload_json,
      testId: test.id,
      testVersion: attempt.version,
      questions: test.questions,
      sessionId: attempt.session_id,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
