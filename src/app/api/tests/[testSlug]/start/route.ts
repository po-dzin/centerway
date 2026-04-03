import { NextRequest, NextResponse } from "next/server";
import { adminClient } from "@/lib/auth/adminClient";
import {
  emitDoshaTestEvent,
  ensureDoshaTestSeed,
  loadTestDefinitionBySlug,
} from "@/lib/doshaTestRepo";
import { DOSHA_TEST_SLUG } from "@/lib/doshaTest";

export const runtime = "nodejs";

type StartBody = {
  source?: unknown;
  sessionId?: unknown;
  userId?: unknown;
};

function asString(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s || null;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ testSlug: string }> }
) {
  const { testSlug } = await params;
  if (testSlug !== DOSHA_TEST_SLUG) {
    return NextResponse.json({ error: "test_not_found" }, { status: 404 });
  }

  const body = (await req.json().catch(() => ({}))) as StartBody;
  const source = asString(body.source) ?? "dosha_test_landing";
  const sessionId = asString(body.sessionId) ?? crypto.randomUUID();
  const userId = asString(body.userId) ?? null;

  try {
    const db = adminClient();
    await ensureDoshaTestSeed(db);
    const test = await loadTestDefinitionBySlug(db, DOSHA_TEST_SLUG);

    if (!test) {
      return NextResponse.json({ error: "test_not_available" }, { status: 404 });
    }

    await emitDoshaTestEvent(db, "dosha_test_started", {
      attemptId: null,
      testId: test.id,
      testVersion: test.version,
      source,
      sessionId,
      timestamp: new Date().toISOString(),
      userId,
    });

    return NextResponse.json({
      testId: test.id,
      testVersion: test.version,
      currentQuestionIndex: 1,
      totalQuestions: test.questions.length,
      questions: test.questions,
      sessionId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
