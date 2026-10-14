/**
 * «Завтра старт» and «Сьогодні старт» for a group stream, in Telegram.
 *
 * The letters (`lib/email/lifecycleRuns.ts`) reach every buyer by address; this
 * reaches the buyers whose chat is linked — through the order link after
 * payment, the cabinet, or the dosha test — in the chat where the daily «День N»
 * then keeps arriving. The same people as the letters (`streamRecipients`),
 * narrowed to a chat:
 *  - «завтра» goes to every one of them;
 *  - «сьогодні» skips a learner whose enrollment carries the date: the morning
 *    «День 1 · …» from `runDailyReminders` is already that message, and two of
 *    them on one morning would be noise. A buyer who never opened the course has
 *    no enrollment, so this is the only Telegram word they get on day one.
 *
 * Not behind `LIFECYCLE_EMAILS`: the daily Telegram reminders never were, and a
 * chat only exists because its owner asked for these messages.
 *
 * At most once, the way the letters are: an `events` row per message
 * (`stream-tg:<stage>:<date>:<email>`), read before sending and written after
 * Telegram accepted it. Never throws for one person.
 */

import { adminClient } from "@/lib/auth/adminClient";
import { ukDate, type StreamStage } from "@/lib/email/lifecycleEmails";
import {
  kyivDate,
  lifecycleLinks,
  STREAM_TELEGRAM_EVENT,
  streamRecipients,
  type StreamRecipient,
} from "@/lib/email/lifecycleRuns";
import { escapeTelegramHtml, sendTelegramCard, type InlineKeyboardMarkup } from "@/lib/telegram/tg";

export type StreamTelegramResult = { candidates: number; sent: number; skipped: number; failed: number };

/** Pure: the message for one stage, so the wording is tested without a chat. */
export function buildStreamTelegram(input: {
  stage: StreamStage;
  programTitle: string;
  startsOn: string;
  cabinetUrl: string;
  streamChatUrl: string | null;
}): { html: string; replyMarkup: InlineKeyboardMarkup } {
  const title = `«${escapeTelegramHtml(input.programTitle)}»`;
  const html =
    input.stage === "tomorrow"
      ? [
          `<b>Завтра старт · ${escapeTelegramHtml(input.programTitle)}</b>`,
          "",
          `Завтра, ${ukDate(input.startsOn)}, починається потік ${title}. Перший урок з'явиться в кабінеті зранку.`,
          "Якщо ще не заходили в кабінет — увійдіть сьогодні з поштою, на яку прийшов чек.",
        ].join("\n")
      : [
          `<b>День 1 · ${escapeTelegramHtml(input.programTitle)}</b>`,
          "",
          `Сьогодні старт потоку ${title}. Перший урок уже чекає в кабінеті.`,
        ].join("\n");

  const rows: InlineKeyboardMarkup["inline_keyboard"] = [
    [{ text: input.stage === "tomorrow" ? "Відкрити кабінет" : "Відкрити перший урок", url: input.cabinetUrl }],
  ];
  if (input.streamChatUrl) rows.push([{ text: "Чат потоку", url: input.streamChatUrl }]);
  return { html, replyMarkup: { inline_keyboard: rows } };
}

/** Pure: who of the stream's people gets the Telegram message at this stage. */
export function streamTelegramAudience(recipients: StreamRecipient[], stage: StreamStage): StreamRecipient[] {
  return recipients.filter((r) => r.tgId && (stage === "tomorrow" || !r.enrolled));
}

async function sentBefore(refs: string[]): Promise<Set<string>> {
  if (refs.length === 0) return new Set();
  const { data, error } = await adminClient()
    .from("events")
    .select("order_ref")
    .eq("type", STREAM_TELEGRAM_EVENT)
    .in("order_ref", refs);
  if (error) throw new Error(error.message);
  return new Set((data ?? []).map((row) => row.order_ref as string));
}

export async function runStreamTelegram(now = new Date()): Promise<Record<StreamStage, StreamTelegramResult>> {
  const links = lifecycleLinks();
  const db = adminClient();
  const out = {} as Record<StreamStage, StreamTelegramResult>;

  for (const [stage, date] of [
    ["tomorrow", kyivDate(now, 1)],
    ["day1", kyivDate(now, 0)],
  ] as [StreamStage, string][]) {
    const audience = streamTelegramAudience(await streamRecipients(date), stage);
    const refOf = (r: StreamRecipient) => `stream-tg:${stage}:${date}:${r.email}`;
    const done = await sentBefore(audience.map(refOf));
    const result: StreamTelegramResult = { candidates: audience.length, sent: 0, skipped: 0, failed: 0 };
    // One message per chat: two addresses linked to one chat must not hear it twice.
    const chats = new Set<string>();

    for (const recipient of audience) {
      const ref = refOf(recipient);
      const chat = recipient.tgId as string;
      if (done.has(ref) || chats.has(chat)) {
        result.skipped++;
        continue;
      }
      chats.add(chat);
      const message = buildStreamTelegram({
        stage,
        programTitle: recipient.programTitle,
        startsOn: date,
        cabinetUrl: links.cabinetUrl,
        streamChatUrl: links.streamChatUrl ?? null,
      });
      try {
        await sendTelegramCard(chat, message);
      } catch (error) {
        console.warn("[stream-telegram] not sent", { ref, error: error instanceof Error ? error.message : error });
        result.failed++;
        continue;
      }
      result.sent++;
      const { error } = await db
        .from("events")
        .insert({ type: STREAM_TELEGRAM_EVENT, order_ref: ref, payload: { telegram_chat_id: chat } });
      if (error) console.warn("[stream-telegram] sent but not recorded", { ref, error: error.message });
    }
    out[stage] = result;
  }
  return out;
}
