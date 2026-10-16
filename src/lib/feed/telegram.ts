/**
 * The feed in the team's Telegram group (2026-10-16). Server-only.
 *
 * G's rule: no manual review. Only what the check stopped reaches people, as a
 * card in the work group (`SUPPORT_CHAT_ID`, thread `FEED_THREAD_ID` or the
 * shared support thread) with two buttons that act right there:
 *   «Опублікувати» — the post goes out as it is;
 *   «Повернути»    — the post goes back to its author, and the bot asks for a
 *                    reason as a reply to the card; the reply is what the author
 *                    reads in «Мої дописи».
 * A held comment gets the same card with «Опублікувати» / «Прибрати».
 *
 * WHO MAY PRESS. Anyone in the work group — the card is only ever there. A
 * press from any other chat (a forwarded card) is refused.
 *
 * NEVER THROWS INTO THE WRITE. Sending the card runs after the author has their
 * answer; a Telegram failure is logged and the post simply waits as held,
 * visible in «Мої дописи», which is the same state a missing group leaves.
 */

import { callTelegramBotApi, escapeTelegramHtml, type InlineKeyboardMarkup } from "@/lib/telegram/tg";

import type { GateVerdict } from "./gate";
import { decideHeldPost, readHeldPost, rememberCardMessage, setReturnReason, type Db } from "./server";

const PREFIX = "feed:";
const CARD_TEXT_LIMIT = 1200;

function groupChatId(): string | null {
  const raw = process.env.SUPPORT_CHAT_ID?.trim();
  return raw ? raw : null;
}

function groupThreadId(): number | null {
  const raw = process.env.FEED_THREAD_ID ?? process.env.SUPPORT_THREAD_ID;
  return raw && /^\d+$/.test(raw) ? Number(raw) : null;
}

function sameChat(a: number | string, b: string): boolean {
  const norm = (value: string) => value.replace(/^-?(100)?/, "");
  return norm(String(a)) === norm(b);
}

function clip(text: string, max = CARD_TEXT_LIMIT): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function findingsHtml(verdict: GateVerdict | null): string {
  if (!verdict) return "";
  return verdict.findings
    .map((finding) => `Гейт: ${escapeTelegramHtml(finding.label)} — ${escapeTelegramHtml(finding.detail)}`)
    .join("\n");
}

/** The card's text, pure, so the test reads what the team will read. */
export function heldPostCardHtml(card: { authorName: string; body: string; verdict: GateVerdict | null }): string {
  return [
    "<b>Автоперевірка зупинила допис у Стрічці</b>",
    `Автор: ${escapeTelegramHtml(card.authorName)}`,
    "",
    escapeTelegramHtml(clip(card.body)),
    "",
    findingsHtml(card.verdict),
  ]
    .filter((line, index, all) => !(line === "" && all[index - 1] === ""))
    .join("\n")
    .trim();
}

export function heldCommentCardHtml(card: { body: string; verdict: GateVerdict | null }): string {
  return [
    "<b>Автоперевірка зупинила коментар у Стрічці</b>",
    "",
    escapeTelegramHtml(clip(card.body, 600)),
    "",
    findingsHtml(card.verdict),
  ]
    .join("\n")
    .trim();
}

function postKeyboard(id: string): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: "Опублікувати", callback_data: `${PREFIX}pub:${id}` },
        { text: "Повернути", callback_data: `${PREFIX}ret:${id}` },
      ],
    ],
  };
}

function commentKeyboard(id: string): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: "Опублікувати", callback_data: `${PREFIX}cpub:${id}` },
        { text: "Прибрати", callback_data: `${PREFIX}cdel:${id}` },
      ],
    ],
  };
}

async function sendCard(html: string, keyboard: InlineKeyboardMarkup): Promise<number | null> {
  const chatId = groupChatId();
  if (!chatId) return null;
  const thread = groupThreadId();
  const sent = await callTelegramBotApi<{ message_id: number }>("sendMessage", {
    chat_id: chatId,
    text: html,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    reply_markup: keyboard,
    ...(thread ? { message_thread_id: thread } : {}),
  });
  return sent?.message_id ?? null;
}

/** Sends the card for a held post and remembers which message it is. */
export async function sendHeldPostCard(db: Db, postId: string): Promise<void> {
  try {
    const card = await readHeldPost(db, postId);
    if (!card || card.status !== "held") return;
    const messageId = await sendCard(heldPostCardHtml(card), postKeyboard(postId));
    if (messageId) await rememberCardMessage(db, postId, messageId);
  } catch (error) {
    console.error("feed_held_card_failed:", error instanceof Error ? error.message : error);
  }
}

export async function sendHeldCommentCard(
  commentId: string,
  comment: { body: string; verdict: GateVerdict | null },
): Promise<void> {
  try {
    await sendCard(heldCommentCardHtml(comment), commentKeyboard(commentId));
  } catch (error) {
    console.error("feed_held_comment_card_failed:", error instanceof Error ? error.message : error);
  }
}

/* ─────────────────────────── the group's answers ─────────────────────────── */

type CallbackMessage = { message_id: number; chat: { id: number }; text?: string };
type Callback = { id: string; data?: string; from: { id: number; first_name?: string }; message?: CallbackMessage };

export function isFeedCallback(data: string | undefined): boolean {
  return Boolean(data?.startsWith(PREFIX));
}

async function answer(callbackId: string, text: string): Promise<void> {
  await callTelegramBotApi("answerCallbackQuery", { callback_query_id: callbackId, text }).catch(() => undefined);
}

async function closeCard(message: CallbackMessage, line: string): Promise<void> {
  const original = escapeTelegramHtml(message.text ?? "");
  await callTelegramBotApi("editMessageText", {
    chat_id: message.chat.id,
    message_id: message.message_id,
    text: `${original}\n\n<b>${escapeTelegramHtml(line)}</b>`,
    parse_mode: "HTML",
    disable_web_page_preview: true,
  }).catch((error) => console.error("feed_card_edit_failed:", error instanceof Error ? error.message : error));
}

/**
 * A press on a feed card. Answers the press in every case, so the button stops
 * spinning; refuses presses from outside the work group.
 */
export async function handleFeedCallback(db: Db, callback: Callback, now: Date = new Date()): Promise<void> {
  const data = callback.data ?? "";
  const message = callback.message;
  const group = groupChatId();
  if (!message || !group || !sameChat(message.chat.id, group)) {
    await answer(callback.id, "Ця кнопка працює лише в робочій групі.");
    return;
  }

  const [, action, id] = data.split(":");
  const who = callback.from.first_name ?? String(callback.from.id);
  const by = `tg:${callback.from.id}`;

  if (action === "pub" || action === "ret") {
    const result = await decideHeldPost(db, id ?? "", action === "pub" ? "publish" : "return", by, now);
    if (!result.changed) {
      await answer(callback.id, result.status === "published" ? "Уже опубліковано." : "Уже вирішено.");
      return;
    }
    await answer(callback.id, action === "pub" ? "Опубліковано." : "Повернуто автору.");
    await closeCard(
      message,
      action === "pub"
        ? `Опубліковано · ${who}`
        : `Повернуто автору · ${who}. Відповідайте на це повідомлення — причину перешлю автору.`,
    );
    return;
  }

  if (action === "cpub" || action === "cdel") {
    const at = now.toISOString();
    const query =
      action === "cpub"
        ? db
            .from("feed_comments")
            .update({ status: "published" })
            .eq("id", id ?? "")
            .eq("status", "held")
        : db
            .from("feed_comments")
            .update({ hidden_at: at })
            .eq("id", id ?? "")
            .eq("status", "held");
    const { data: rows } = await query.select("id");
    if ((rows ?? []).length === 0) {
      await answer(callback.id, "Уже вирішено.");
      return;
    }
    await answer(callback.id, action === "cpub" ? "Опубліковано." : "Прибрано.");
    await closeCard(message, action === "cpub" ? `Опубліковано · ${who}` : `Прибрано · ${who}`);
    return;
  }

  await answer(callback.id, "Невідома дія.");
}

/**
 * A reply in the work group to a returned post's card: the reason for the
 * author. True when the message was that, so the caller stops there.
 */
export async function handleFeedReply(
  db: Db,
  message: { chat: { id: number }; text?: string; reply_to_message?: { message_id: number } },
): Promise<boolean> {
  const group = groupChatId();
  const replyTo = message.reply_to_message?.message_id;
  const text = message.text?.trim();
  if (!group || !replyTo || !text || !sameChat(message.chat.id, group)) return false;
  return setReturnReason(db, replyTo, text);
}
