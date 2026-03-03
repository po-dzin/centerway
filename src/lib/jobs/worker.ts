import { adminClient } from "@/lib/auth/adminClient";
import { sendCapiEvent } from "@/lib/tracking/capi";

// Simple job registry
type JobHandler = (payload: any) => Promise<void>;

const handlers: Record<string, JobHandler> = {
    "meta:capi": async (payload) => {
        await sendCapiEvent(payload);
    },
};


export function registerJobHandler(type: string, handler: JobHandler) {
    handlers[type] = handler;
}

// Ensure the execution doesn't block forever and locks jobs
export async function processPendingJobs(limit = 10) {
    const db = adminClient();

    // 1. Fetch pending jobs that are due
    const { data: jobs, error } = await db
        .from("jobs")
        .select("*")
        .in("status", ["pending", "failed"])
        .lte("run_at", new Date().toISOString())
        .lt("attempts", 3) // max 3 attempts
        .order("run_at", { ascending: true })
        .limit(limit);

    if (error || !jobs || jobs.length === 0) return 0;

    // 2. Mark as running
    const jobIds = jobs.map(j => j.id);
    await db.from("jobs").update({ status: "running" }).in("id", jobIds);

    let processed = 0;

    // 3. Process each job
    for (const job of jobs) {
        try {
            const handler = handlers[job.type];
            if (!handler) {
                throw new Error(`No handler registered for job type: ${job.type}`);
            }

            await handler(job.payload);

            // Success
            await db.from("jobs").update({
                status: "success",
                error_text: null
            }).eq("id", job.id);
            processed++;

        } catch (err: any) {
            console.error(`Job [${job.id}] failed:`, err);

            // Calculate next attempt (exponential backoff)
            const attempts = job.attempts + 1;
            const nextRunAt = new Date();
            nextRunAt.setMinutes(nextRunAt.getMinutes() + Math.pow(5, attempts)); // wait 5m, 25m, 125m

            await db.from("jobs").update({
                status: attempts >= 3 ? "failed" : "pending",
                attempts: attempts,
                error_text: err.message || String(err),
                run_at: nextRunAt.toISOString()
            }).eq("id", job.id);
        }
    }

    return processed;
}
