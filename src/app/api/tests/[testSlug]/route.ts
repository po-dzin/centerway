import { NextResponse } from "next/server";
import { adminClient } from "@/lib/auth/adminClient";
import { DOSHA_TEST_SLUG, presentQuestionsForSession } from "@/lib/doshaTest";
import { ensureDoshaTestSeed, loadTestDefinitionBySlug } from "@/lib/doshaTestRepo";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ testSlug: string }> }
) {
  const { testSlug } = await params;
  if (testSlug !== DOSHA_TEST_SLUG) {
    return NextResponse.json({ error: "test_not_found" }, { status: 404 });
  }

  try {
    const db = adminClient();
    await ensureDoshaTestSeed(db);
    const test = await loadTestDefinitionBySlug(db, DOSHA_TEST_SLUG);
    if (!test) {
      return NextResponse.json({ error: "test_not_available" }, { status: 404 });
    }

    /* The session decides the order of the answers. Without one the order is
       still shuffled, just not reproducibly — a reader with no session has
       nothing to walk back to. */
    const sessionId = new URL(req.url).searchParams.get("sessionId")?.trim() || crypto.randomUUID();

    return NextResponse.json({
      testId: test.id,
      testVersion: test.version,
      totalQuestions: test.questions.length,
      questions: presentQuestionsForSession(test.questions, sessionId),
      sessionId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
