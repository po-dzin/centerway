import { describe, expect, it } from "vitest";

import { balanceAttemptPayload, checkBalanceAnswers, readBalancePayload } from "./balanceAttempt";
import { BALANCE_QUESTIONS, BALANCE_TEST_SLUG, type BalanceType } from "./balanceTest";

function answersOf(type: BalanceType) {
  return BALANCE_QUESTIONS.map((question) => ({
    questionCode: question.code,
    optionCode: question.options.find((option) => option.type === type)!.code,
  }));
}

describe("checkBalanceAnswers", () => {
  it("accepts one answer per question and returns the types in order", () => {
    const checked = checkBalanceAnswers(answersOf("vata"));
    expect(checked.ok).toBe(true);
    if (checked.ok) expect(checked.types).toEqual(BALANCE_QUESTIONS.map(() => "vata"));
  });

  it("refuses a missing question", () => {
    expect(checkBalanceAnswers(answersOf("vata").slice(1))).toEqual({ ok: false, error: "answers_count_mismatch" });
  });

  it("refuses a question answered twice", () => {
    const answers = answersOf("vata");
    answers[1] = { ...answers[0]! };
    expect(checkBalanceAnswers(answers)).toEqual({ ok: false, error: "duplicate_question_answer" });
  });

  it("refuses another question's option and an unknown question", () => {
    const foreign = answersOf("vata");
    foreign[0] = { questionCode: foreign[0]!.questionCode, optionCode: foreign[1]!.optionCode };
    expect(checkBalanceAnswers(foreign)).toEqual({ ok: false, error: "option_not_in_question" });

    const unknown = answersOf("vata");
    unknown[0] = { questionCode: "zz", optionCode: "zz" };
    expect(checkBalanceAnswers(unknown)).toEqual({ ok: false, error: "question_not_in_test" });
  });

  it("refuses something that is not a list", () => {
    expect(checkBalanceAnswers({})).toEqual({ ok: false, error: "answers_required" });
  });
});

describe("balance payload", () => {
  it("is scored on the server and reads back", () => {
    const checked = checkBalanceAnswers(answersOf("kapha"));
    if (!checked.ok) throw new Error("fixture");
    const payload = balanceAttemptPayload(checked.types, checked.byQuestion, "2026-10-02T00:00:00.000Z");
    expect(payload.testSlug).toBe(BALANCE_TEST_SLUG);
    expect(payload.primary).toBe("kapha");
    expect(payload.scores.kapha).toBe(BALANCE_QUESTIONS.length);
    expect(readBalancePayload(payload)?.primary).toBe("kapha");
  });

  it("does not read a dosha payload as a balance one", () => {
    expect(readBalancePayload({ resultType: "vata", scores: { vata: 1 } })).toBeNull();
  });
});
