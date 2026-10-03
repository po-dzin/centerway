/**
 * A finished balance test, kept on the server (2026-10-02).
 *
 * The balance test used to be nine choices scored in the browser and thrown
 * away — no row, nothing in the cabinet, nothing to compare the next run with.
 * Its result now opens in full after sign-in, like the dosha test's, so it has
 * to live somewhere an account can own it.
 *
 * ONE ROW IN `test_attempts`, NO MIGRATION. The table is the dosha test's, and
 * two of its shapes do not fit: `result_type` is the `dosha_result_type` enum
 * (no `balance`), and `test_answers.option_id` points at `test_options`, which
 * this test does not use (its instrument lives in code — balanceTest.ts). So a
 * balance row leaves `result_type` NULL and writes no answer rows: the three
 * dosha counts go in the score columns and the whole reading, with the answers
 * by question code, in `result_payload_json`.
 *
 * NULL `result_type` IS ALSO WHAT KEEPS IT OUT OF THE DOSHA READERS. Every one
 * of them — the cabinet's view, the analytics, the reminder cron, the
 * `/me/dosha` fallback — asks for a non-null `result_type` or for `started`
 * rows, so a balance result can never be read as somebody's constitution.
 *
 * Scored HERE, from the codes, never from a score the client sends: the client
 * scores too (it draws the free part of the screen before the round trip ends),
 * but the stored reading is the server's.
 */

import {
  BALANCE_QUESTIONS,
  BALANCE_TEST_SLUG,
  readBalance,
  scoreBalanceAnswers,
  type BalanceReading,
  type BalanceType,
} from "./balanceTest";

export type BalanceAnswerInput = { questionCode: string; optionCode: string };

export type BalanceAnswersCheck =
  { ok: true; types: BalanceType[]; byQuestion: Record<string, string> } | { ok: false; error: string };

/** Every question answered exactly once, with one of its own options. */
export function checkBalanceAnswers(input: unknown): BalanceAnswersCheck {
  if (!Array.isArray(input)) return { ok: false, error: "answers_required" };

  const byQuestion: Record<string, string> = {};
  const types: BalanceType[] = [];
  for (const row of input as Array<Partial<BalanceAnswerInput>>) {
    const questionCode = typeof row?.questionCode === "string" ? row.questionCode : null;
    const optionCode = typeof row?.optionCode === "string" ? row.optionCode : null;
    if (!questionCode || !optionCode) return { ok: false, error: "answers_required" };

    const question = BALANCE_QUESTIONS.find((entry) => entry.code === questionCode);
    if (!question) return { ok: false, error: "question_not_in_test" };
    if (byQuestion[questionCode]) return { ok: false, error: "duplicate_question_answer" };

    const option = question.options.find((entry) => entry.code === optionCode);
    if (!option) return { ok: false, error: "option_not_in_question" };

    byQuestion[questionCode] = optionCode;
    types.push(option.type);
  }

  if (types.length !== BALANCE_QUESTIONS.length) return { ok: false, error: "answers_count_mismatch" };
  return { ok: true, types, byQuestion };
}

export type BalanceAttemptPayload = {
  testSlug: typeof BALANCE_TEST_SLUG;
  primary: BalanceReading["primary"];
  secondary: BalanceReading["secondary"];
  scores: BalanceReading["scores"];
  answers: Record<string, string>;
  completedAt: string;
};

export function balanceAttemptPayload(
  types: readonly BalanceType[],
  answers: Record<string, string>,
  completedAt: string,
): BalanceAttemptPayload {
  const reading = readBalance(scoreBalanceAnswers(types));
  return {
    testSlug: BALANCE_TEST_SLUG,
    primary: reading.primary,
    secondary: reading.secondary,
    scores: reading.scores,
    answers,
    completedAt,
  };
}

/** The stored reading back out of a row, or null when the row is not one. */
export function readBalancePayload(value: unknown): BalanceAttemptPayload | null {
  if (!value || typeof value !== "object") return null;
  const payload = value as Partial<BalanceAttemptPayload>;
  if (payload.testSlug !== BALANCE_TEST_SLUG || typeof payload.primary !== "string" || !payload.scores) return null;
  return payload as BalanceAttemptPayload;
}
