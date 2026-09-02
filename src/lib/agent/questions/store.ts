/**
 * Recording a question, and reading the corpus back.
 *
 * The write is BEST-EFFORT AND SILENT. Capturing a question is an observation
 * about a conversation, never a step in it: a person asking the support bot for
 * help must not see an error, lose their message, or wait a millisecond longer
 * because a corpus table was unavailable. Every failure here is logged and
 * swallowed.
 *
 * The redaction is not optional and not the caller's job — `capture` runs it
 * itself, so there is no call site that could pass raw text by forgetting.
 */

import { adminClient } from "@/lib/auth/adminClient";
import { isStorableQuestion, redactPersonal } from "./redact";

export type QuestionSource = "bot_fallback" | "bot_support" | "assistant";

export type CapturedQuestion = {
  id: string;
  text: string;
  source: QuestionSource;
  expectedDocId: string | null;
  topic: string | null;
  createdAt: string;
};

/** Longer than any question anyone asks; past this the message is a document. */
const MAX_QUESTION_CHARS = 2000;

/**
 * Stores one question, if what is left of it after redaction is a question.
 *
 * Returns whether it was stored — for tests and for the caller's own log, never
 * for the person, who is told nothing about this at all.
 */
export async function captureQuestion(input: { text: string; source: QuestionSource }): Promise<boolean> {
  const raw = input.text?.trim() ?? "";
  if (!raw) return false;

  const { text, removed } = redactPersonal(raw.slice(0, MAX_QUESTION_CHARS));
  if (!isStorableQuestion(text)) return false;

  try {
    const { error } = await adminClient()
      .from("agent_questions")
      .insert({ text, source: input.source, redacted: removed });
    if (error) {
      console.error("[questions] capture failed:", error.message);
      return false;
    }
    return true;
  } catch (error) {
    console.error("[questions] capture threw:", error instanceof Error ? error.message : error);
    return false;
  }
}

function toQuestion(row: Record<string, unknown>): CapturedQuestion {
  return {
    id: row.id as string,
    text: row.text as string,
    source: row.source as QuestionSource,
    expectedDocId: (row.expected_doc_id as string | null) ?? null,
    topic: (row.topic as string | null) ?? null,
    createdAt: row.created_at as string,
  };
}

/**
 * The corpus, newest first.
 *
 * `labelled: true` returns only the rows a person has said the right answer
 * for — which is the set the evaluation runs against. Unlabelled rows are the
 * work queue, not the measurement.
 */
export async function listQuestions(
  options: { limit?: number; labelled?: boolean; source?: QuestionSource } = {}
): Promise<CapturedQuestion[]> {
  let query = adminClient()
    .from("agent_questions")
    .select("id, text, source, expected_doc_id, topic, created_at")
    .order("created_at", { ascending: false })
    .limit(options.limit ?? 200);

  if (options.labelled === true) query = query.not("expected_doc_id", "is", null);
  if (options.labelled === false) query = query.is("expected_doc_id", null);
  if (options.source) query = query.eq("source", options.source);

  const { data, error } = await query;
  if (error) throw new Error(`agent_questions_read_failed:${error.message}`);
  return (data ?? []).map((row) => toQuestion(row as Record<string, unknown>));
}
