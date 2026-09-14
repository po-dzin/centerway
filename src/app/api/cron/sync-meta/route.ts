import { NextResponse } from "next/server";
import { requireCronAuth } from "@/lib/cron/auth";
import { syncMetaAdsInsights } from "@/lib/tracking/metaAdsSync";
import { sendTelegramMessage } from "@/lib/telegram/tg";

export const runtime = "nodejs";
export const maxDuration = 120;

// Same convention as shelf-check: report failure to the support channel, but
// never let a broken channel take down the cron's own error response with it.
async function reportFailure(message: string): Promise<void> {
  const chatId = process.env.SUPPORT_CHAT_ID;
  if (!chatId) return;

  const threadRaw = process.env.SUPPORT_THREAD_ID;
  const messageThreadId = threadRaw && /^\d+$/.test(threadRaw) ? Number(threadRaw) : null;

  try {
    await sendTelegramMessage(chatId, `Meta sync cron failed: ${message}`, { messageThreadId });
  } catch (error) {
    console.error("sync_meta_report_failed:", error instanceof Error ? error.message : error);
  }
}

export async function GET(req: Request) {
  const authError = requireCronAuth(req);
  if (authError) {
    return authError;
  }

  try {
    const result = await syncMetaAdsInsights();
    return NextResponse.json({ success: true, result });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("Meta sync cron failed:", message);
    await reportFailure(message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
