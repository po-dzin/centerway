import { NextRequest, NextResponse } from "next/server";
import { adminClient } from "@/lib/auth/adminClient";
import { loadTestAttempt, syncCustomerDoshaTestTags } from "@/lib/doshaTestRepo";
import type { DoshaResultType } from "@/lib/doshaTest";
import type { CapiEventPayload } from "@/lib/tracking/capi";
import { requireUserFromBearer } from "@/lib/auth/requireUser";
import { enforceRateLimit, tooManyRequests } from "@/lib/rateLimit";

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ attemptId: string }> }
) {
  const rl = await enforceRateLimit(req, { name: "test_attach", limit: 30, windowSeconds: 60 });
  if (!rl.allowed) return tooManyRequests(rl.retryAfter);

  const { attemptId } = await params;
  const user = await requireUserFromBearer(req.headers.get("authorization"));
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const userId = user.id;

  try {
    const db = adminClient();
    const attempt = await loadTestAttempt(db, attemptId);
    if (!attempt) {
      return NextResponse.json({ error: "attempt_not_found" }, { status: 404 });
    }

    const { data: claimed, error } = await db
      .from("test_attempts")
      .update({ user_id: userId })
      .eq("id", attempt.id)
      .is("user_id", null)
      .select("id");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    /* Everything below happens on the FIRST claim only. An attempt already
       owned by this account is not a new person and must not be counted as
       one — the update above matches no row in that case. */
    const isFirstClaim = (claimed ?? []).length > 0;
    const resultType = attempt.result_type as DoshaResultType | null;

    if (isFirstClaim && resultType) {
      /* The tags used to be written only when the test was completed while
         already signed in. An anonymous run that signed in afterwards — now
         the normal path — reached the cabinet untagged. */
      await syncCustomerDoshaTestTags(db, { userId, resultType });

      /* THIS is the lead: a result and a way to reach the person who got it.
         The event fired on completion instead, including for readers we had
         no contact for, so Meta was optimising towards a number that did not
         mean anyone. Same event_id as the signed-in completion path, so the
         two can never double-count. */
      const capiLeadPayload: CapiEventPayload = {
        event_name: "Lead",
        event_id: `dosha_lead_${attempt.id}`,
        event_time: Math.floor(Date.now() / 1000),
        action_source: "website",
        content_name: "dosha_test",
        content_type: "lead",
        content_ids: [resultType],
        email: user.email ?? null,
        ip_address:
          req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? req.headers.get("x-real-ip") ?? null,
        user_agent: req.headers.get("user-agent"),
      };
      try {
        await db.from("jobs").insert({ type: "meta:capi", status: "pending", payload: capiLeadPayload });
      } catch {
        // fire-and-forget; the attempt is already claimed
      }
    }

    return NextResponse.json({ ok: true, attemptId: attempt.id, userId, resultType, claimed: isFirstClaim });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
