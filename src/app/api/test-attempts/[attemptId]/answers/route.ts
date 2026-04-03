import { NextRequest, NextResponse } from "next/server";
import { adminClient } from "@/lib/auth/adminClient";
import { calculateDoshaResult, isValidScoreInvariant, DOSHA_TEST_SLUG } from "@/lib/doshaTest";
import {
  emitDoshaTestEvent,
  ensureDoshaTestSeed,
  findTestOptionById,
  findTestQuestionById,
  loadAnswersForTestAttempt,
  loadTestAttempt,
  loadTestDefinitionBySlug,
  syncCustomerDoshaTestTags,
} from "@/lib/doshaTestRepo";

export const runtime = "nodejs";

type SubmitAnswerBody = {
  questionId?: unknown;
  optionId?: unknown;
};

function asString(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s || null;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ attemptId: string }> }
) {
  const { attemptId } = await params;
  const body = (await req.json().catch(() => ({}))) as SubmitAnswerBody;
  const questionId = asString(body.questionId);
  const optionId = asString(body.optionId);

  if (!questionId || !optionId) {
    return NextResponse.json({ error: "question_id_and_option_id_required" }, { status: 400 });
  }

  try {
    const db = adminClient();
    await ensureDoshaTestSeed(db);

    const attempt = await loadTestAttempt(db, attemptId);
    if (!attempt) {
      return NextResponse.json({ error: "attempt_not_found" }, { status: 404 });
    }

    if (attempt.status !== "started") {
      return NextResponse.json({ error: "attempt_not_active" }, { status: 409 });
    }

    const test = await loadTestDefinitionBySlug(db, DOSHA_TEST_SLUG);
    if (!test || test.id !== attempt.test_id) {
      return NextResponse.json({ error: "test_not_found" }, { status: 404 });
    }

    const question = await findTestQuestionById(db, questionId, attempt.test_id);
    if (!question) {
      return NextResponse.json({ error: "question_not_in_test" }, { status: 400 });
    }

    const option = await findTestOptionById(db, optionId, question.id);
    if (!option) {
      return NextResponse.json({ error: "option_not_in_question" }, { status: 400 });
    }

    const { data: existing, error: existingError } = await db
      .from("test_answers")
      .select("id")
      .eq("attempt_id", attempt.id)
      .eq("question_id", question.id)
      .maybeSingle();

    if (existingError) {
      return NextResponse.json({ error: existingError.message }, { status: 500 });
    }

    const answersBefore = await loadAnswersForTestAttempt(db, attempt.id);

    if (!existing) {
      const answerOrder = answersBefore.length + 1;
      const { error: insertAnswerError } = await db.from("test_answers").insert({
        attempt_id: attempt.id,
        question_id: question.id,
        option_id: option.id,
        mapped_dosha: option.mapped_dosha,
        answer_order: answerOrder,
      });

      if (insertAnswerError) {
        return NextResponse.json({ error: insertAnswerError.message }, { status: 500 });
      }

      const incrementPatch: Record<string, number> = {
        score_vata: attempt.score_vata,
        score_pitta: attempt.score_pitta,
        score_kapha: attempt.score_kapha,
      };

      if (option.mapped_dosha === "vata") incrementPatch.score_vata += 1;
      if (option.mapped_dosha === "pitta") incrementPatch.score_pitta += 1;
      if (option.mapped_dosha === "kapha") incrementPatch.score_kapha += 1;

      await db
        .from("test_attempts")
        .update({
          ...incrementPatch,
          current_question_index: Math.min(answerOrder + 1, test.questions.length),
          last_activity_at: new Date().toISOString(),
        })
        .eq("id", attempt.id)
        .eq("status", "started");

      await emitDoshaTestEvent(db, "dosha_question_answered", {
        attemptId: attempt.id,
        testId: attempt.test_id,
        questionId: question.id,
        questionIndex: question.order_index,
        optionId: option.id,
        mappedDosha: option.mapped_dosha,
        timestamp: new Date().toISOString(),
      });
    }

    const answersAfter = await loadAnswersForTestAttempt(db, attempt.id);
    const answeredCount = answersAfter.length;

    const vata = answersAfter.filter((a) => a.mapped_dosha === "vata").length;
    const pitta = answersAfter.filter((a) => a.mapped_dosha === "pitta").length;
    const kapha = answersAfter.filter((a) => a.mapped_dosha === "kapha").length;

    if (!isValidScoreInvariant({ vata, pitta, kapha }, answeredCount)) {
      return NextResponse.json({ error: "score_invariant_failed" }, { status: 500 });
    }

    if (answeredCount < test.questions.length) {
      return NextResponse.json({
        attemptId: attempt.id,
        currentQuestionIndex: Math.min(answeredCount + 1, test.questions.length),
        isCompleted: false,
        answeredCount,
        scores: { vata, pitta, kapha },
      });
    }

    const resultType = calculateDoshaResult(vata, pitta, kapha);
    const completedAt = new Date().toISOString();

    const { error: completeUpdateError } = await db
      .from("test_attempts")
      .update({
        status: "completed",
        completed_at: completedAt,
        current_question_index: test.questions.length,
        score_vata: vata,
        score_pitta: pitta,
        score_kapha: kapha,
        result_type: resultType,
        result_payload_json: {
          resultType,
          scores: { vata, pitta, kapha },
          completedAt,
        },
      })
      .eq("id", attempt.id)
      .eq("status", "started");

    if (completeUpdateError) {
      return NextResponse.json({ error: completeUpdateError.message }, { status: 500 });
    }

    if (attempt.user_id) {
      await syncCustomerDoshaTestTags(db, {
        userId: attempt.user_id,
        resultType,
      });
    }

    const basePayload = {
      attemptId: attempt.id,
      testId: attempt.test_id,
      testVersion: attempt.version,
      resultType,
      scores: { vata, pitta, kapha },
      completedAt,
    };

    await emitDoshaTestEvent(db, "dosha_test_completed", basePayload);
    await emitDoshaTestEvent(db, "dosha_result_calculated", basePayload);

    return NextResponse.json({
      attemptId: attempt.id,
      isCompleted: true,
      resultType,
      scores: { vata, pitta, kapha },
      completedAt,
      nextStep: "consultation",
      answeredCount,
      currentQuestionIndex: test.questions.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
