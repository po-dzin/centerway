import { after } from "next/server";
import { sendCapiEvent, type CapiEventPayload } from "@/lib/tracking/capi";
import { getErrorMessage } from "@/lib/errors";

/**
 * Near-real-time CAPI dispatch.
 *
 * The producing route already inserted a `jobs` row (status "pending") holding the
 * durable payload. That row stays the fallback: on Hobby the `/api/cron/process-jobs`
 * cron only runs once per day, so waiting for it delayed every server-side Meta event
 * by up to ~24h. Here we additionally try to send the event immediately, inside
 * `after()` so the HTTP response is never blocked by the Meta round-trip.
 *
 * - Inline send succeeds  → flip the job row to "success" so the cron skips it.
 * - Inline send fails      → leave the row "pending"; the daily cron retries it via the
 *                            worker exactly as before (network blip, 5xx, token issue…).
 * - No request scope       → `after()` throws (background script / test); we swallow it
 *                            and let the cron be the only path, same as legacy behaviour.
 *
 * Meta also deduplicates by `event_id` within its window, so a rare inline+cron double
 * send is collapsed on their side — the job-status flip just avoids the wasted call.
 *
 * `payload` may be a resolver so callers with a thin job payload (Purchase) can build the
 * enriched CAPI payload lazily inside the deferred task instead of on the request path.
 */
type JobId = string | number;

// Minimal shape shared by supabaseAdmin() and adminClient() clients used by callers.
type JobsUpdatableClient = {
  from: (table: string) => {
    update: (values: Record<string, unknown>) => {
      eq: (column: string, value: JobId) => PromiseLike<{ error: unknown }>;
    };
  };
};

export function dispatchCapiEventInline(
  db: JobsUpdatableClient,
  jobId: JobId,
  payload: CapiEventPayload | (() => Promise<CapiEventPayload>),
): void {
  const task = async () => {
    try {
      const resolved = typeof payload === "function" ? await payload() : payload;
      await sendCapiEvent(resolved);
      await db.from("jobs").update({ status: "success", error_text: null }).eq("id", jobId);
    } catch (err) {
      // Non-fatal: the job stays pending/failed and the cron worker retries it.
      console.warn("[capi inline] send failed, left for cron retry:", {
        jobId,
        error: getErrorMessage(err),
      });
    }
  };

  try {
    after(task);
  } catch {
    // Called outside a request scope (e.g. a background script). The durable job row is
    // already persisted, so the cron worker remains responsible for delivery.
  }
}

/**
 * Test-mode variant: sends straight to Meta with no `jobs` row and no DB fallback.
 * Used only while CW_META_TEST_MODE is on, for event types that don't need a durable
 * retry path (ViewContent). A failed send here is simply lost, not retried.
 */
export function dispatchCapiEventDirect(payload: CapiEventPayload): void {
  const task = async () => {
    try {
      await sendCapiEvent(payload);
    } catch (err) {
      console.warn("[capi direct] send failed (test mode, no retry):", {
        event_name: payload.event_name,
        event_id: payload.event_id,
        error: getErrorMessage(err),
      });
    }
  };

  try {
    after(task);
  } catch {
    // Called outside a request scope; nothing durable was written, so the event is dropped.
  }
}
