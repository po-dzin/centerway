/**
 * A line to the house, in the group where the house already is.
 *
 * WHAT THIS IS FOR. Some events have no screen that anybody watches. A lead,
 * a broken shelf, a course sent for review — each of them is a row somewhere,
 * and a row waits for someone to come and look. The support group is where the
 * house actually is during the day, so that is where these go.
 *
 * ONE THREAD, DELIBERATELY. Requests, support and product notices share it
 * until the volume justifies splitting them; a caller that later earns its own
 * thread passes `threadId` and nothing else changes.
 *
 * IT NEVER THROWS, AND THAT IS THE WHOLE CONTRACT. Every caller is doing
 * something real — persisting a lead, submitting a course — and a notice about
 * that act must not be able to fail the act itself. The result says what
 * happened so a caller that wants to log it can; none of them has to.
 *
 * FOUR OLDER COPIES of this exist inline (`api/leads`, `api/sp/webhook`,
 * `api/cron/shelf-check`, `api/cron/sync-meta`). They are the reason this file
 * is here rather than a fifth one being written; they can move onto it without
 * changing behaviour, and should when one of them is next touched.
 */

import { sendTelegramMessage } from "@/lib/telegram/tg";

export type HouseNotice = "sent" | "no_channel" | "failed";

/** The thread a notice lands in: the caller's own, or the shared support one. */
function resolveThread(threadId?: string | null): number | null {
  const raw = threadId ?? process.env.SUPPORT_THREAD_ID;
  return raw && /^\d+$/.test(raw) ? Number(raw) : null;
}

export async function notifyHouseThread(text: string, options?: { threadId?: string | null }): Promise<HouseNotice> {
  const chatId = process.env.SUPPORT_CHAT_ID;
  /* Not a failure: a local run and a preview deployment have no group, and a
     notice is not something they should be made to carry. */
  if (!chatId) return "no_channel";

  try {
    await sendTelegramMessage(chatId, text, { messageThreadId: resolveThread(options?.threadId) });
    return "sent";
  } catch (error) {
    console.error("house_notice_failed:", error instanceof Error ? error.message : error);
    return "failed";
  }
}
