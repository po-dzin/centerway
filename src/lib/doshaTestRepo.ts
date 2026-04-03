import { adminClient } from "@/lib/auth/adminClient";
import {
  DOSHA_TEST_QUESTIONS,
  DOSHA_TEST_SLUG,
  DOSHA_TEST_VERSION,
  DoshaResultType,
  BaseDosha,
  doshaTagFromResult,
} from "@/lib/doshaTest";

type SupabaseAdmin = ReturnType<typeof adminClient>;

type TestDefinitionRow = {
  id: string;
  slug: string;
  title: string;
  version: string;
  status: "draft" | "active" | "archived";
};

type TestQuestionRow = {
  id: string;
  test_id: string;
  order_index: number;
  question_code: string;
  question_text: string;
  status: "active" | "hidden";
};

type TestOptionRow = {
  id: string;
  question_id: string;
  option_order: number;
  option_code: string;
  option_text: string;
  mapped_dosha: BaseDosha;
};

export type TestQuestionDto = {
  id: string;
  orderIndex: number;
  code: string;
  text: string;
  options: Array<{
    id: string;
    order: number;
    code: string;
    text: string;
    mappedDosha: BaseDosha;
  }>;
};

export type TestDefinitionDto = {
  id: string;
  slug: string;
  title: string;
  version: string;
  questions: TestQuestionDto[];
};

export type TestAttemptRow = {
  id: string;
  user_id: string | null;
  test_id: string;
  session_id: string;
  source: string | null;
  status: "started" | "completed" | "abandoned";
  started_at: string;
  completed_at: string | null;
  last_activity_at: string;
  current_question_index: number;
  score_vata: number;
  score_pitta: number;
  score_kapha: number;
  result_type: DoshaResultType | null;
  result_payload_json: Record<string, unknown> | null;
  reminder_sent_count: number;
  version: string;
  created_at: string;
  updated_at: string;
};

export type TestAnswerRow = {
  id: string;
  attempt_id: string;
  question_id: string;
  option_id: string;
  mapped_dosha: BaseDosha;
  answer_order: number;
  created_at: string;
};

export async function ensureDoshaTestSeed(db: SupabaseAdmin): Promise<TestDefinitionRow> {
  const forceReseed = process.env.DOSHA_TEST_FORCE_RESEED === "1";
  const { data: existing, error: existingError } = await db
    .from("test_definitions")
    .select("id, slug, title, version, status")
    .eq("slug", DOSHA_TEST_SLUG)
    .maybeSingle();

  if (existingError) {
    throw new Error(`test_definition_load_failed: ${existingError.message}`);
  }

  let test = existing as TestDefinitionRow | null;
  if (test && !forceReseed) {
    // Hot path: test is already provisioned, avoid re-upserting the whole matrix per request.
    return test;
  }

  if (!test) {
    const { data: inserted, error: insertError } = await db
      .from("test_definitions")
      .insert({
        slug: DOSHA_TEST_SLUG,
        title: "Dosha Test",
        version: DOSHA_TEST_VERSION,
        status: "active",
      })
      .select("id, slug, title, version, status")
      .single();

    if (insertError || !inserted) {
      throw new Error(`test_definition_insert_failed: ${insertError?.message ?? "unknown"}`);
    }

    test = inserted as TestDefinitionRow;
  }

  for (const question of DOSHA_TEST_QUESTIONS) {
    const { data: qRow, error: qErr } = await db
      .from("test_questions")
      .upsert(
        {
          test_id: test.id,
          order_index: question.order,
          question_code: question.code,
          question_text: question.text,
          status: "active",
        },
        { onConflict: "test_id,question_code" }
      )
      .select("id, test_id, order_index, question_code, question_text, status")
      .single();

    if (qErr || !qRow) {
      throw new Error(`test_question_upsert_failed:${question.code}:${qErr?.message ?? "unknown"}`);
    }

    for (const option of question.options) {
      const { error: oErr } = await db.from("test_options").upsert(
        {
          question_id: qRow.id,
          option_order: option.order,
          option_code: option.code,
          option_text: option.text,
          mapped_dosha: option.mappedDosha,
        },
        { onConflict: "question_id,option_code" }
      );

      if (oErr) {
        throw new Error(`test_option_upsert_failed:${option.code}:${oErr.message}`);
      }
    }
  }

  return test;
}

export async function loadTestDefinitionBySlug(db: SupabaseAdmin, slug: string): Promise<TestDefinitionDto | null> {
  const { data: definition, error: definitionError } = await db
    .from("test_definitions")
    .select("id, slug, title, version, status")
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();

  if (definitionError) {
    throw new Error(`test_definition_load_failed:${definitionError.message}`);
  }
  if (!definition) return null;

  const { data: questions, error: questionsError } = await db
    .from("test_questions")
    .select("id, test_id, order_index, question_code, question_text, status")
    .eq("test_id", definition.id)
    .eq("status", "active")
    .order("order_index", { ascending: true });

  if (questionsError) {
    throw new Error(`test_questions_load_failed:${questionsError.message}`);
  }

  const questionIds = (questions ?? []).map((q: any) => q.id);
  const { data: options, error: optionsError } = await db
    .from("test_options")
    .select("id, question_id, option_order, option_code, option_text, mapped_dosha")
    .in("question_id", questionIds.length ? questionIds : ["00000000-0000-0000-0000-000000000000"])
    .order("option_order", { ascending: true });

  if (optionsError) {
    throw new Error(`test_options_load_failed:${optionsError.message}`);
  }

  const optionsByQuestion = new Map<string, TestOptionRow[]>();
  for (const opt of (options ?? []) as TestOptionRow[]) {
    const arr = optionsByQuestion.get(opt.question_id) ?? [];
    arr.push(opt);
    optionsByQuestion.set(opt.question_id, arr);
  }

  const dtoQuestions: TestQuestionDto[] = ((questions ?? []) as TestQuestionRow[]).map((q) => ({
    id: q.id,
    orderIndex: q.order_index,
    code: q.question_code,
    text: q.question_text,
    options: (optionsByQuestion.get(q.id) ?? []).map((opt) => ({
      id: opt.id,
      order: opt.option_order,
      code: opt.option_code,
      text: opt.option_text,
      mappedDosha: opt.mapped_dosha,
    })),
  }));

  return {
    id: definition.id,
    slug: definition.slug,
    title: definition.title,
    version: definition.version,
    questions: dtoQuestions,
  };
}

export async function createTestAttempt(
  db: SupabaseAdmin,
  params: {
    testId: string;
    sessionId: string;
    source: string | null;
    userId: string | null;
    version: string;
  }
): Promise<TestAttemptRow> {
  const now = new Date().toISOString();
  const { data, error } = await db
    .from("test_attempts")
    .insert({
      user_id: params.userId,
      test_id: params.testId,
      session_id: params.sessionId,
      source: params.source,
      status: "started",
      started_at: now,
      last_activity_at: now,
      current_question_index: 1,
      score_vata: 0,
      score_pitta: 0,
      score_kapha: 0,
      version: params.version,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(`test_attempt_create_failed:${error?.message ?? "unknown"}`);
  }

  return data as TestAttemptRow;
}

export async function loadTestAttempt(db: SupabaseAdmin, attemptId: string): Promise<TestAttemptRow | null> {
  const { data, error } = await db.from("test_attempts").select("*").eq("id", attemptId).maybeSingle();
  if (error) throw new Error(`test_attempt_load_failed:${error.message}`);
  return (data as TestAttemptRow | null) ?? null;
}

export async function loadAnswersForTestAttempt(db: SupabaseAdmin, attemptId: string): Promise<TestAnswerRow[]> {
  const { data, error } = await db
    .from("test_answers")
    .select("*")
    .eq("attempt_id", attemptId)
    .order("answer_order", { ascending: true });

  if (error) {
    throw new Error(`test_answers_load_failed:${error.message}`);
  }

  return (data as TestAnswerRow[]) ?? [];
}

export async function emitDoshaTestEvent(
  db: SupabaseAdmin,
  eventType:
    | "dosha_test_started"
    | "dosha_question_answered"
    | "dosha_test_completed"
    | "dosha_result_calculated"
    | "dosha_result_viewed"
    | "dosha_test_restarted"
    | "dosha_reminder_sent"
    | "dosha_followup_clicked",
  payload: Record<string, unknown>,
  customerId: string | null = null
): Promise<void> {
  const { error } = await db.from("events").insert({
    type: eventType,
    order_ref: null,
    customer_id: customerId,
    payload,
  });

  if (error) {
    // Events are best effort; don't fail test UX on analytics write.
    console.warn(`dosha_event_insert_failed:${eventType}`, error.message);
  }
}

export async function syncCustomerDoshaTestTags(
  db: SupabaseAdmin,
  params: {
    userId: string;
    resultType: DoshaResultType;
  }
): Promise<void> {
  const { data: customer, error } = await db
    .from("customers")
    .select("id, tags")
    .eq("auth_user_id", params.userId)
    .maybeSingle();

  if (error || !customer) return;

  const existingTags: string[] = Array.isArray(customer.tags) ? customer.tags : [];
  const merged = Array.from(new Set([...existingTags, "test_completed", doshaTagFromResult(params.resultType)]));

  await db.from("customers").update({ tags: merged }).eq("id", customer.id);
}

export async function findTestQuestionById(
  db: SupabaseAdmin,
  questionId: string,
  testId: string
): Promise<TestQuestionRow | null> {
  const { data, error } = await db
    .from("test_questions")
    .select("id, test_id, order_index, question_code, question_text, status")
    .eq("id", questionId)
    .eq("test_id", testId)
    .eq("status", "active")
    .maybeSingle();

  if (error) throw new Error(`test_question_lookup_failed:${error.message}`);
  return (data as TestQuestionRow | null) ?? null;
}

export async function findTestOptionById(
  db: SupabaseAdmin,
  optionId: string,
  questionId: string
): Promise<TestOptionRow | null> {
  const { data, error } = await db
    .from("test_options")
    .select("id, question_id, option_order, option_code, option_text, mapped_dosha")
    .eq("id", optionId)
    .eq("question_id", questionId)
    .maybeSingle();

  if (error) throw new Error(`test_option_lookup_failed:${error.message}`);
  return (data as TestOptionRow | null) ?? null;
}
