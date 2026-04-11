import { NextRequest, NextResponse } from "next/server";
import { adminClient } from "@/lib/auth/adminClient";
import { emitDoshaTestEvent, loadTestAttempt } from "@/lib/doshaTestRepo";

export const runtime = "nodejs";

type EventBody = {
  eventName?: unknown;
  target?: unknown;
  screen?: unknown;
  step?: unknown;
  ctaTarget?: unknown;
  cta_target?: unknown;
  uiVariant?: unknown;
  ui_variant?: unknown;
  resultType?: unknown;
  scores?: unknown;
  completedAt?: unknown;
  nextStep?: unknown;
  experimentKey?: unknown;
  variantKey?: unknown;
  manifestId?: unknown;
  manifestVersion?: unknown;
  recipeVersion?: unknown;
  mode?: unknown;
  branch?: unknown;
  assignmentSource?: unknown;
};

function asString(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s || null;
}

function asFiniteNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function asScorePayload(v: unknown): { vata: number; pitta: number; kapha: number } | null {
  if (!v || typeof v !== "object") return null;
  const record = v as Record<string, unknown>;
  const vata = asFiniteNumber(record.vata);
  const pitta = asFiniteNumber(record.pitta);
  const kapha = asFiniteNumber(record.kapha);
  if (vata === null || pitta === null || kapha === null) return null;
  return { vata, pitta, kapha };
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ attemptId: string }> }
) {
  const { attemptId } = await params;
  const body = (await req.json().catch(() => ({}))) as EventBody;
  const eventName = asString(body.eventName);
  const target = asString(body.target);
  const screen = asString(body.screen);
  const step = asFiniteNumber(body.step);
  const ctaTarget = asString(body.ctaTarget) ?? asString(body.cta_target);
  const uiVariant = asString(body.uiVariant) ?? asString(body.ui_variant);
  const resultType = asString(body.resultType);
  const scores = asScorePayload(body.scores);
  const completedAt = asString(body.completedAt);
  const nextStep = asString(body.nextStep);
  const experimentKey = asString(body.experimentKey);
  const variantKey = asString(body.variantKey);
  const manifestId = asString(body.manifestId);
  const manifestVersion = asString(body.manifestVersion);
  const recipeVersion = asString(body.recipeVersion);
  const mode = asString(body.mode);
  const branch = asString(body.branch);
  const assignmentSource = asString(body.assignmentSource);

  if (!eventName || !["dosha_result_viewed", "dosha_followup_clicked"].includes(eventName)) {
    return NextResponse.json({ error: "invalid_event_name" }, { status: 400 });
  }

  try {
    const db = adminClient();
    const attempt = await loadTestAttempt(db, attemptId);
    if (!attempt) {
      return NextResponse.json({ error: "attempt_not_found" }, { status: 404 });
    }

    await emitDoshaTestEvent(
      db,
      eventName as "dosha_result_viewed" | "dosha_followup_clicked",
      {
        attemptId: attempt.id,
        testId: attempt.test_id,
        resultType: attempt.result_type,
        target: target ?? null,
        screen: screen ?? null,
        step,
        ctaTarget: ctaTarget ?? null,
        uiVariant: uiVariant ?? null,
        experimentKey: experimentKey ?? null,
        variantKey: variantKey ?? null,
        manifestId: manifestId ?? null,
        manifestVersion: manifestVersion ?? null,
        recipeVersion: recipeVersion ?? null,
        mode: mode ?? null,
        branch: branch ?? null,
        assignmentSource: assignmentSource ?? null,
        resultView: eventName === "dosha_result_viewed"
          ? {
              resultType: resultType ?? attempt.result_type,
              scores,
              completedAt: completedAt ?? attempt.completed_at,
              nextStep,
            }
          : null,
        timestamp: new Date().toISOString(),
      }
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
