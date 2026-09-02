/**
 * The daily "is anything missing from the storefront" watch.
 *
 * WHAT IT IS FOR. A course leaves the shelf silently — see shelfHealth.ts. The
 * admin screen now shows the fault in the row, but only to someone who happens
 * to open that screen, and the course that went missing on 2026-09-01 was found
 * by a person noticing an empty space in the catalogue two days later. This is
 * the part that does the noticing.
 *
 * IT SPEAKS ONLY WHEN SOMETHING IS WRONG. A daily "all good" is a message the
 * reader learns to dismiss, and a watcher whose alarms are dismissed by habit
 * is worse than none — it is the same silence with a false sense of cover. The
 * JSON answer always carries the full audit, so a manual call still shows the
 * green state.
 *
 * Scheduled in pg_cron beside the other jobs (memory: schedules moved off
 * Vercel on 2026-08-29) — docs/migration/sql/2026-09-02_shelf_check_cron.sql.
 */

import { NextResponse } from "next/server";

import { requireCronAuth } from "@/lib/cron/auth";
import { auditShelf, formatShelfAudit } from "@/lib/lms/shelfHealth";
import { sendTelegramMessage } from "@/lib/tg";

export const runtime = "nodejs";

async function report(text: string): Promise<"sent" | "no_channel" | "failed"> {
    const chatId = process.env.SUPPORT_CHAT_ID;
    if (!chatId) return "no_channel";

    const threadRaw = process.env.SUPPORT_THREAD_ID;
    const messageThreadId = threadRaw && /^\d+$/.test(threadRaw) ? Number(threadRaw) : null;

    try {
        await sendTelegramMessage(chatId, text, { messageThreadId });
        return "sent";
    } catch (error) {
        // A watcher that dies of its own alarm reports nothing ever again: the
        // audit still returns, and the log keeps the reason.
        console.error("shelf_check_report_failed:", error instanceof Error ? error.message : error);
        return "failed";
    }
}

export async function GET(req: Request) {
    const authError = requireCronAuth(req);
    if (authError) return authError;

    try {
        const audit = await auditShelf();
        const message = formatShelfAudit(audit);
        const reported = message ? await report(message) : "not_needed";

        // Loud in the runtime log too, so the fault is visible to whoever is
        // already looking at logs rather than only in Telegram.
        if (audit.faults.length > 0) {
            console.error(`lms_shelf_faults:${audit.faults.map((fault) => `${fault.slug}:${fault.kind}`).join(",")}`);
        }

        return NextResponse.json({ success: true, reported, ...audit });
    } catch (error) {
        const detail = error instanceof Error ? error.message : "unknown_error";
        await report(`Перевірка вітрини не виконалась: ${detail}`);
        return NextResponse.json({ success: false, error: detail }, { status: 500 });
    }
}
