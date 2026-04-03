import { NextRequest, NextResponse } from "next/server";
import { adminClient } from "@/lib/auth/adminClient";
import { requireUserFromBearer } from "@/lib/auth/requireUser";
import { calculateDoshaResult, DOSHA_TEST_SLUG, isValidScoreInvariant } from "@/lib/doshaTest";
import {
  createTestAttempt,
  emitDoshaTestEvent,
  ensureDoshaTestSeed,
  findTestOptionById,
  findTestQuestionById,
  loadAnswersForTestAttempt,
  loadTestDefinitionBySlug,
  syncCustomerDoshaTestTags,
  type TestAttemptRow,
} from "@/lib/doshaTestRepo";

export const runtime = "nodejs";

type CompleteAnswer = {
  questionId?: unknown;
  optionId?: unknown;
};

type CompleteBody = {
  answers?: unknown;
  source?: unknown;
  sessionId?: unknown;
};

function asString(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s || null;
}

function toAnswerList(input: unknown): Array<{ questionId: string; optionId: string }> | null {
  if (!Array.isArray(input)) return null;
  const parsed: Array<{ questionId: string; optionId: string }> = [];
  for (const row of input as CompleteAnswer[]) {
    const questionId = asString(row?.questionId);
    const optionId = asString(row?.optionId);
    if (!questionId || !optionId) return null;
    parsed.push({ questionId, optionId });
  }
  return parsed;
}

async function findIdempotentAttempt(
  db: ReturnType<typeof adminClient>,
  params: {
    testId: string;
    sessionId: string;
    expectedAnswers: Record<string, string>;
  }
): Promise<TestAttemptRow | null> {
  const threshold = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { data, error } = await db
    .from("test_attempts")
    .select("*")
    .eq("test_id", params.testId)
    .eq("session_id", params.sessionId)
    .eq("status", "completed")
    .gte("created_at", threshold)
    .order("created_at", { ascending: false })
    .limit(3);

  if (error) {
    throw new Error(`test_attempt_idempotency_lookup_failed:${error.message}`);
  }

  for (const row of (data ?? []) as TestAttemptRow[]) {
    const answers = await loadAnswersForTestAttempt(db, row.id);
    if (answers.length !== Object.keys(params.expectedAnswers).length) continue;

    let matches = true;
    for (const answer of answers) {
      if (params.expectedAnswers[answer.question_id] !== answer.option_id) {
        matches = false;
        break;
      }
    }

    if (matches) return row;
  }

  return null;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ testSlug: string }> }
) {
  const { testSlug } = await params;
  if (testSlug !== DOSHA_TEST_SLUG) {
    return NextResponse.json({ error: "test_not_found" }, { status: 404 });
  }

  const body = (await req.json().catch(() => ({}))) as CompleteBody;
  const answers = toAnswerList(body.answers);
  const source = asString(body.source) ?? "dosha_test_route";
  const sessionId = asString(body.sessionId) ?? crypto.randomUUID();

  if (!answers) {
    return NextResponse.json({ error: "answers_required" }, { status: 400 });
  }

  try {
    const db = adminClient();
    await ensureDoshaTestSeed(db);
    const test = await loadTestDefinitionBySlug(db, DOSHA_TEST_SLUG);
    if (!test) {
      return NextResponse.json({ error: "test_not_available" }, { status: 404 });
    }

    if (answers.length !== test.questions.length) {
      return NextResponse.json(
        { error: "answers_count_mismatch", expected: test.questions.length, received: answers.length },
        { status: 400 }
      );
    }

    const expectedByQuestion: Record<string, string> = {};
    for (const answer of answers) {
      if (expectedByQuestion[answer.questionId]) {
        return NextResponse.json({ error: "duplicate_question_answer" }, { status: 400 });
      }
      expectedByQuestion[answer.questionId] = answer.optionId;
    }

    const user = await requireUserFromBearer(req.headers.get("authorization"));
    const userId = user?.id ?? null;

    const idempotent = await findIdempotentAttempt(db, {
      testId: test.id,
      sessionId,
      expectedAnswers: expectedByQuestion,
    });
    if (idempotent && idempotent.result_type) {
      return NextResponse.json({
        attemptId: idempotent.id,
        isCompleted: true,
        resultType: idempotent.result_type,
        scores: {
          vata: idempotent.score_vata,
          pitta: idempotent.score_pitta,
          kapha: idempotent.score_kapha,
        },
        completedAt: idempotent.completed_at,
        nextStep: (idempotent.result_payload_json?.nextStep as string | undefined) ?? "consultation",
      });
    }

    const attempt = await createTestAttempt(db, {
      testId: test.id,
      sessionId,
      source,
      userId,
      version: test.version,
    });

    const answerRows: Array<{
      attempt_id: string;
      question_id: string;
      option_id: string;
      mapped_dosha: "vata" | "pitta" | "kapha";
      answer_order: number;
    }> = [];

    for (let idx = 0; idx < answers.length; idx += 1) {
      const answer = answers[idx];
      const question = await findTestQuestionById(db, answer.questionId, test.id);
      if (!question) {
        return NextResponse.json({ error: "question_not_in_test", questionId: answer.questionId }, { status: 400 });
      }

      const option = await findTestOptionById(db, answer.optionId, question.id);
      if (!option) {
        return NextResponse.json({ error: "option_not_in_question", optionId: answer.optionId }, { status: 400 });
      }

      answerRows.push({
        attempt_id: attempt.id,
        question_id: question.id,
        option_id: option.id,
        mapped_dosha: option.mapped_dosha,
        answer_order: idx + 1,
      });
    }

    const { error: insertAnswersError } = await db.from("test_answers").insert(answerRows);
    if (insertAnswersError) {
      return NextResponse.json({ error: insertAnswersError.message }, { status: 500 });
    }

    const vata = answerRows.filter((a) => a.mapped_dosha === "vata").length;
    const pitta = answerRows.filter((a) => a.mapped_dosha === "pitta").length;
    const kapha = answerRows.filter((a) => a.mapped_dosha === "kapha").length;

    if (!isValidScoreInvariant({ vata, pitta, kapha }, test.questions.length)) {
      return NextResponse.json({ error: "score_invariant_failed" }, { status: 500 });
    }

    const resultType = calculateDoshaResult(vata, pitta, kapha);
    const completedAt = new Date().toISOString();
    const nextStep = "consultation";

    const { error: completeError } = await db
      .from("test_attempts")
      .update({
        status: "completed",
        completed_at: completedAt,
        current_question_index: test.questions.length,
        score_vata: vata,
        score_pitta: pitta,
        score_kapha: kapha,
        result_type: resultType,
        last_activity_at: completedAt,
        result_payload_json: {
          resultType,
          scores: { vata, pitta, kapha },
          completedAt,
          nextStep,
        },
      })
      .eq("id", attempt.id)
      .eq("status", "started");

    if (completeError) {
      return NextResponse.json({ error: completeError.message }, { status: 500 });
    }

    if (userId) {
      await syncCustomerDoshaTestTags(db, {
        userId,
        resultType,
      });
    }

    const eventPayload = {
      attemptId: attempt.id,
      testId: test.id,
      testVersion: test.version,
      source,
      sessionId,
      resultType,
      scores: { vata, pitta, kapha },
      completedAt,
      nextStep,
      userId,
    };

    await emitDoshaTestEvent(db, "dosha_test_completed", eventPayload);
    await emitDoshaTestEvent(db, "dosha_result_calculated", eventPayload);

    return NextResponse.json({
      attemptId: attempt.id,
      isCompleted: true,
      resultType,
      scores: { vata, pitta, kapha },
      completedAt,
      nextStep,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
