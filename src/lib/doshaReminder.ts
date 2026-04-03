import { adminClient } from "@/lib/auth/adminClient";
import { emitDoshaTestEvent } from "@/lib/doshaTestRepo";

type ReminderJobPayload = {
  attemptId: string;
};

function asObject(v: unknown): Record<string, unknown> | null {
  if (!v || typeof v !== "object") return null;
  return v as Record<string, unknown>;
}

export function isReminderJobPayload(v: unknown): v is ReminderJobPayload {
  const o = asObject(v);
  return !!o && typeof o.attemptId === "string" && o.attemptId.length > 10;
}

export async function enqueueDoshaReminderJobs(limit = 100): Promise<number> {
  const db = adminClient();
  const nowIso = new Date().toISOString();
  const reminder1Threshold = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const reminder2Threshold = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: firstBatch, error: firstBatchError } = await db
    .from("test_attempts")
    .select("id, test_id, user_id, session_id, reminder_sent_count, last_activity_at")
    .eq("status", "started")
    .is("result_type", null)
    .eq("reminder_sent_count", 0)
    .lte("last_activity_at", reminder1Threshold)
    .order("last_activity_at", { ascending: true })
    .limit(limit);

  const { data: secondBatch, error: secondBatchError } = await db
    .from("test_attempts")
    .select("id, test_id, user_id, session_id, reminder_sent_count, last_activity_at")
    .eq("status", "started")
    .is("result_type", null)
    .eq("reminder_sent_count", 1)
    .lte("last_activity_at", reminder2Threshold)
    .order("last_activity_at", { ascending: true })
    .limit(limit);

  if (firstBatchError || secondBatchError) return 0;

  const attempts = [...(firstBatch ?? []), ...(secondBatch ?? [])];
  if (attempts.length === 0) return 0;

  let enqueued = 0;
  for (const attempt of attempts) {
    const { data: completedLater, error: completedError } = await db
      .from("test_attempts")
      .select("id")
      .eq("test_id", attempt.test_id)
      .eq("status", "completed")
      .or(
        attempt.user_id
          ? `user_id.eq.${attempt.user_id},session_id.eq.${attempt.session_id}`
          : `session_id.eq.${attempt.session_id}`
      )
      .gt("created_at", attempt.last_activity_at)
      .limit(1);

    if (completedError) continue;
    if ((completedLater ?? []).length > 0) continue;

    const { error: insertError } = await db.from("jobs").insert({
      type: "dosha:reminder",
      payload: { attemptId: attempt.id },
      status: "pending",
      run_at: nowIso,
    });

    if (!insertError) enqueued += 1;
  }

  return enqueued;
}

export async function processDoshaReminderJob(payload: unknown): Promise<void> {
  if (!isReminderJobPayload(payload)) {
    throw new Error("Invalid payload for dosha:reminder job");
  }

  const db = adminClient();
  const { data: attempt, error } = await db
    .from("test_attempts")
    .select("id, test_id, user_id, session_id, status, result_type, reminder_sent_count, last_activity_at")
    .eq("id", payload.attemptId)
    .maybeSingle();

  if (error || !attempt) {
    throw new Error("Reminder attempt not found");
  }

  if (attempt.status !== "started" || attempt.result_type) {
    return;
  }

  if ((attempt.reminder_sent_count ?? 0) >= 2) {
    return;
  }

  const { data: newerCompleted } = await db
    .from("test_attempts")
    .select("id")
    .eq("test_id", attempt.test_id)
    .eq("status", "completed")
    .or(
      attempt.user_id
        ? `user_id.eq.${attempt.user_id},session_id.eq.${attempt.session_id}`
        : `session_id.eq.${attempt.session_id}`
    )
    .gt("completed_at", attempt.last_activity_at)
    .limit(1);

  if ((newerCompleted ?? []).length > 0) {
    return;
  }

  const nextCount = (attempt.reminder_sent_count ?? 0) + 1;
  const { error: updateError } = await db
    .from("test_attempts")
    .update({ reminder_sent_count: nextCount })
    .eq("id", attempt.id)
    .eq("status", "started")
    .is("result_type", null);

  if (updateError) {
    throw new Error(`Reminder counter update failed: ${updateError.message}`);
  }

  await emitDoshaTestEvent(db, "dosha_reminder_sent", {
    attemptId: attempt.id,
    testId: attempt.test_id,
    reminderSentCount: nextCount,
    timestamp: new Date().toISOString(),
  });
}
