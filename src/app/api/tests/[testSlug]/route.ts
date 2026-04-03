import { NextResponse } from "next/server";
import { adminClient } from "@/lib/auth/adminClient";
import { DOSHA_TEST_SLUG } from "@/lib/doshaTest";
import { ensureDoshaTestSeed, loadTestDefinitionBySlug } from "@/lib/doshaTestRepo";

export const runtime = "nodejs";

export async function GET(
  _: Request,
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

    return NextResponse.json({
      testId: test.id,
      testVersion: test.version,
      totalQuestions: test.questions.length,
      questions: test.questions,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
