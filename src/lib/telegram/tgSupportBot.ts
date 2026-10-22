/**
 * CenterWay support bot.
 *
 * SHAPE (rewritten 2026-08-21). The bot used to open by asking "which course
 * interests you?" and refuse to do anything until one was picked — a product
 * picker as the front door, for people who mostly arrive with one question:
 * "where is the thing I paid for?". The course is now a PARAMETER of the one
 * task that needs it (checking a payment), not a prerequisite for the bot.
 *
 * WHERE COURSES LIVE. way21 and reset-day run on the platform, at /learn/*,
 * and are reached through the cabinet. Only the two legacy programs still have
 * their own Telegram bots. Everything here says so; the previous copy told
 * every learner their materials were "inside the product bot", which for the
 * newer courses was simply untrue.
 *
 * All strings are in ./tgSupportBotCopy.ts — see its header for the voice.
 */

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { normalizeEmail } from "@/lib/strings";
import { asJson } from "@/lib/db/types";
import {
  callTelegramBotApi,
  escapeTelegramHtml,
  reactToTelegramMessage,
  sendTelegramCard,
  sendTelegramChatAction,
  sendTelegramMessage,
  type InlineKeyboardButton,
  type InlineKeyboardMarkup,
} from "@/lib/telegram/tg";
import { verifyTelegramLinkToken } from "@/lib/platform/telegramLink";
import { verifyDoshaResultToken } from "@/lib/platform/doshaTelegramLink";
import { verifyOrderTelegramToken } from "@/lib/platform/orderTelegramLink";
import { kyivDate } from "@/lib/email/lifecycleRuns";
import { orderLinkedHtml } from "./orderLinkCopy";
import { channelButton, connectStreamChat, personalInvite, streamChatFor } from "./streamChat";
import { classifyDosha, type DoshaResultType } from "@/lib/dosha/doshaTest";
import { buildDoshaResultHtml, RESULT_COPY } from "@/lib/dosha/doshaResultCopy";
import { DOSHA_PRIMARY_EXIT, doshaExitHref } from "@/lib/dosha/doshaRouting";
import { captureQuestion } from "@/lib/agent/questions/store";
import { handleFeedCallback, handleFeedReply, isFeedCallback } from "@/lib/feed/telegram";
import type { Db as FeedDb } from "@/lib/feed/server";
import { platformUrl } from "@/lib/surfaces/catalog";
import { SUPPORT_BOT_URL } from "@/lib/supportBotUrl";
import {
  botCopy,
  ACCESS_PHOTO_URL,
  CABINET_PHOTO_URL,
  CABINET_URL,
  doshaCardUrl,
  FAQ_PHOTO_URL,
  GREETING_PHOTO_URL,
  SUPPORT_PHOTO_URL,
} from "@/lib/telegram/tgSupportBotCopy";

type Supabase = ReturnType<typeof supabaseAdmin>;
type BotProductCode = "short" | "irem" | "way21" | "reset-day";

type BotState =
  | "idle"
  /* The picker is now a step inside the access task, so the bot has to remember
     that it is mid-task while the buttons are on screen. */
  | "choosing_product_access"
  | "awaiting_access_lookup"
  | "awaiting_support_contact"
  | "awaiting_support_message"
  | "awaiting_bug_message";

type BotSession = {
  telegram_user_id: string;
  telegram_username: string | null;
  selected_product: BotProductCode | null;
  state: BotState;
  contact: string | null;
};

type TelegramUser = {
  id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
};

type TelegramChat = {
  id: number;
  /** `private`, `group`, `supergroup` or `channel`. */
  type?: string;
  title?: string;
};

type TelegramMessage = {
  message_id: number;
  text?: string;
  chat: TelegramChat;
  from?: TelegramUser;
  /** Set when the message answers another — the feed's «why returned» reply. */
  reply_to_message?: { message_id: number };
};

type TelegramCallbackQuery = {
  id: string;
  data?: string;
  from: TelegramUser;
  message?: TelegramMessage;
};

export type TelegramUpdate = {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
};

export const PRODUCT_LABELS: Record<BotProductCode, string> = {
  short: "Шот",
  irem: "IREM",
  way21: "Шлях 21",
  "reset-day": "Легкий день",
};

export type FaqKey = keyof typeof botCopy.faq;

export function assertProduct(value: string | null | undefined): BotProductCode | null {
  if (value === "short" || value === "reboot") return "short";
  if (value === "irem") return "irem";
  if (value === "way21" || value === "shlyah21" || value === "detox21") return "way21";
  if (value === "reset-day" || value === "reset_day" || value === "reset" || value === "rozvantazhennya") {
    return "reset-day";
  }
  return null;
}

export function normalizePhoneDigits(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  if (digits.length < 7) return null;

  if (digits.startsWith("380") && digits.length === 12) return digits;
  if (digits.startsWith("0") && digits.length === 10) {
    return `38${digits}`;
  }
  if (digits.length === 9) return `380${digits}`;
  return digits;
}

function phoneLookupVariants(input: string): string[] {
  const rawDigits = input.replace(/\D/g, "");
  const normalized = normalizePhoneDigits(input);
  const variants = new Set<string>();

  if (rawDigits) variants.add(rawDigits);
  if (normalized) {
    variants.add(normalized);
    variants.add(`+${normalized}`);
    if (normalized.startsWith("380")) {
      variants.add(`0${normalized.slice(3)}`);
    }
  }

  return Array.from(variants);
}

/* Two per row, derived from the label map, so adding a product to the bot is
   one entry and not three places that must agree. */
function productKeyboard(): InlineKeyboardMarkup {
  const buttons = (Object.keys(PRODUCT_LABELS) as BotProductCode[]).map((code) => ({
    text: PRODUCT_LABELS[code],
    callback_data: `product:${code}`,
  }));

  const rows: InlineKeyboardButton[][] = [];
  for (let index = 0; index < buttons.length; index += 2) {
    rows.push(buttons.slice(index, index + 2));
  }
  return { inline_keyboard: rows };
}

/* Ordered by how often it is the reason someone opened the bot. The two short
   orientation branches share a row, keeping the first screen compact on a
   phone; the longer problem/support actions retain their full readable width.

   One sign per button, and only here: five text rows read as a form, and the
   glyph is what lets a returning reader find their row without reading. Answers
   and follow-up buttons stay plain, so the menu is the one place that has them. */
function mainMenuKeyboard(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: "📚 Мої курси", callback_data: "menu:cabinet" },
        { text: "💬 Часті питання", callback_data: "menu:faq" },
      ],
      [{ text: "🔑 Не бачу доступ", callback_data: "menu:access" }],
      [{ text: "✉️ Написати підтримці", callback_data: "menu:support" }],
      [{ text: "🐞 Повідомити про помилку", callback_data: "menu:bug" }],
    ],
  };
}

/* The cabinet answer's own buttons: the place, then the one thing to do if the
   place looks empty. The link is also a word in the text; the button is the
   one-tap form of it. */
function cabinetKeyboard(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [{ text: "Відкрити бібліотеку", url: CABINET_URL }],
      [
        { text: "Не бачу доступ", callback_data: "menu:access" },
        { text: "У меню", callback_data: "menu:back" },
      ],
    ],
  };
}

/* Built FROM the answers, not alongside them. A hand-kept list of buttons and a
   hand-kept map of answers drift, and the drift is silent: the button still
   renders and quietly serves the "інше" fallback. */
function faqKeyboard(): InlineKeyboardMarkup {
  const rows = (Object.keys(botCopy.faqLabels) as FaqKey[]).map((key) => [
    { text: botCopy.faqLabels[key], callback_data: `faq:${key}` },
  ]);
  return { inline_keyboard: [...rows, [{ text: "Назад", callback_data: "menu:back" }]] };
}

function retryKeyboard(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [{ text: "Спробувати інший контакт", callback_data: "menu:access" }],
      [{ text: "Написати підтримці", callback_data: "menu:support" }],
    ],
  };
}

/* Appended to a delivered answer instead of redrawing the whole menu: a reply
   that ends in five buttons reads as a new question, not as an answer. */
function backKeyboard(): InlineKeyboardMarkup {
  return { inline_keyboard: [[{ text: "У меню", callback_data: "menu:back" }]] };
}

function absoluteUrl(href: string): string {
  return href.startsWith("/") ? platformUrl(href) : href;
}

/* Every bot message is HTML — see the copy file's header for why. */
async function sendMessage(chatId: number | string, html: string, replyMarkup?: InlineKeyboardMarkup): Promise<void> {
  await sendTelegramCard(chatId, { html, replyMarkup });
}

/**
 * The greeting, as a captioned brand card.
 *
 * Telegram gives a photo the full width of the column, so imagery is reserved
 * for orientation: the greeting and the two top-level task branches. Follow-up
 * answers remain text-first, keeping a support thread readable.
 *
 * Falls back to plain text if the photo does not go through. The card is
 * decoration; the greeting is the function, and a Telegram hiccup fetching an
 * image must not be what makes /start answer nothing at all.
 */
async function sendCaptionedPhoto(
  chatId: number,
  photo: string,
  caption: string,
  replyMarkup?: InlineKeyboardMarkup,
): Promise<void> {
  await sendTelegramChatAction(chatId, "upload_photo");
  await sendTelegramCard(chatId, { html: caption, photo, replyMarkup });
}

async function sendGreeting(chatId: number): Promise<void> {
  await sendCaptionedPhoto(chatId, GREETING_PHOTO_URL, botCopy.greeting);
}

async function answerCallbackQuery(callbackQueryId: string): Promise<void> {
  await callTelegramBotApi("answerCallbackQuery", {
    callback_query_id: callbackQueryId,
  });
}

async function getSession(db: Supabase, user: TelegramUser): Promise<BotSession> {
  const userId = String(user.id);
  const { data, error } = await db
    .from("support_bot_sessions")
    .select("telegram_user_id, telegram_username, selected_product, state, contact")
    .eq("telegram_user_id", userId)
    .maybeSingle();

  if (error) throw error;

  return {
    telegram_user_id: userId,
    telegram_username: data?.telegram_username ?? user.username ?? null,
    selected_product: assertProduct(data?.selected_product),
    state: (data?.state as BotState | undefined) ?? "idle",
    contact: data?.contact ?? null,
  };
}

async function saveSession(
  db: Supabase,
  user: TelegramUser,
  patch: Partial<Omit<BotSession, "telegram_user_id">>,
): Promise<void> {
  const payload = {
    telegram_user_id: String(user.id),
    telegram_username: user.username ?? null,
    ...patch,
  };

  const { error } = await db.from("support_bot_sessions").upsert(payload, { onConflict: "telegram_user_id" });
  if (error) throw error;
}

async function logEventBestEffort(db: Supabase, type: string, payload: Record<string, unknown>): Promise<void> {
  await db.from("events").insert({ type, order_ref: null, payload: asJson(payload) });
}

async function findPaidOrder(db: Supabase, product: BotProductCode, contact: string): Promise<boolean> {
  const email = normalizeEmail(contact);
  const phoneVariants = phoneLookupVariants(contact);
  const customerIds = new Set<string>();

  if (email) {
    const { data, error } = await db.from("customers").select("id").eq("email", email).limit(20);
    if (error) throw error;
    for (const row of data ?? []) {
      if (row.id) customerIds.add(String(row.id));
    }
  }

  if (phoneVariants.length > 0) {
    const { data, error } = await db.from("customers").select("id").in("phone", phoneVariants).limit(20);
    if (error) throw error;
    for (const row of data ?? []) {
      if (row.id) customerIds.add(String(row.id));
    }
  }

  if (customerIds.size === 0) return false;

  const { data, error } = await db
    .from("orders")
    .select("id")
    .eq("status", "paid")
    .eq("product_code", product)
    .in("customer_id", Array.from(customerIds))
    .limit(1);

  if (error) throw error;
  return Boolean(data?.[0]?.id);
}

async function sendProductPicker(chatId: number, withContextCard: boolean = false): Promise<void> {
  if (withContextCard) {
    await sendCaptionedPhoto(chatId, ACCESS_PHOTO_URL, botCopy.accessPickProduct, productKeyboard());
    return;
  }
  await sendMessage(chatId, botCopy.accessPickProduct, productKeyboard());
}

/**
 * The bot's home screen. Takes no product: the menu is the same whoever is
 * reading it, and there is nothing to "choose" before asking a question.
 */
async function sendMainMenu(chatId: number, prompt: string = botCopy.menuPrompt): Promise<void> {
  await sendMessage(chatId, prompt, mainMenuKeyboard());
}

/**
 * Every menu branch is reachable from a cold start — none of them waits on a
 * previously chosen course. Only `access` asks for one, and asks for it itself.
 */
async function handleMenuAction(db: Supabase, chatId: number, user: TelegramUser, action: string): Promise<void> {
  if (action === "back") {
    await saveSession(db, user, { state: "idle", contact: null });
    await sendMainMenu(chatId);
    return;
  }

  if (action === "cabinet") {
    await saveSession(db, user, { state: "idle", contact: null });
    await sendCaptionedPhoto(chatId, CABINET_PHOTO_URL, botCopy.cabinet, cabinetKeyboard());
    return;
  }

  if (action === "access") {
    await saveSession(db, user, { state: "choosing_product_access", contact: null });
    await sendProductPicker(chatId, true);
    return;
  }

  if (action === "faq") {
    await saveSession(db, user, { state: "idle" });
    await sendCaptionedPhoto(chatId, FAQ_PHOTO_URL, botCopy.faqPrompt, faqKeyboard());
    return;
  }

  if (action === "support") {
    // `selected_product` is cleared, not carried: the support branch no longer
    // asks which course a request concerns, so anything still in the session is
    // left over from an earlier access lookup. Kept, it labels the ticket and
    // the `tg_bot_support_requested` event with a course the person may not be
    // writing about at all — support triage reading a wrong course name is
    // worse than reading "не обрано", which is at least true.
    await saveSession(db, user, {
      state: "awaiting_support_contact",
      contact: null,
      selected_product: null,
    });
    await sendCaptionedPhoto(chatId, SUPPORT_PHOTO_URL, botCopy.supportAskContact);
    return;
  }
  if (action === "bug") {
    await saveSession(db, user, { state: "awaiting_bug_message", contact: null, selected_product: null });
    await sendMessage(chatId, botCopy.bugAskMessage);
    return;
  }

  await sendMainMenu(chatId);
}

async function handleAccessLookup(
  db: Supabase,
  chatId: number,
  user: TelegramUser,
  session: BotSession,
  contact: string,
): Promise<void> {
  if (!session.selected_product) {
    await saveSession(db, user, { state: "idle", contact: null });
    await sendProductPicker(chatId);
    return;
  }

  // The lookup is two or three reads; «друкує…» says the contact was taken
  // and something is happening, instead of a pause that reads as nothing.
  await sendTelegramChatAction(chatId);

  const found = await findPaidOrder(db, session.selected_product, contact);

  await logEventBestEffort(db, found ? "tg_bot_access_granted" : "tg_bot_access_denied", {
    telegram_user_id: String(user.id),
    telegram_username: user.username ?? null,
    product_code: session.selected_product,
    contact_type: normalizeEmail(contact) ? "email" : "phone",
  }).catch(() => undefined);

  await saveSession(db, user, { state: "idle", contact: null });

  if (found) {
    await sendAccessAnswer(chatId, session.selected_product);
    return;
  }

  await sendMessage(chatId, botCopy.accessNotFound, retryKeyboard());
}

/**
 * What "you have access" means, now that it means one thing.
 *
 * There is no secret link to hand over — the course is simply in the cabinet —
 * so the useful answer is the cabinet plus the one thing that makes it look
 * empty when it is not: signing in with a different address than the order was
 * placed on. This used to branch, because Short and IREM were delivered by
 * their own bots and the answer for them was a deep link.
 */
async function sendAccessAnswer(chatId: number, product: BotProductCode): Promise<void> {
  await sendMessage(chatId, botCopy.accessFoundPlatform(PRODUCT_LABELS[product]), {
    inline_keyboard: [
      [{ text: "Відкрити бібліотеку", url: CABINET_URL }],
      [{ text: "У меню", callback_data: "menu:back" }],
    ],
  });
}

async function handleSupportContact(db: Supabase, chatId: number, user: TelegramUser, contact: string): Promise<void> {
  await saveSession(db, user, {
    state: "awaiting_support_message",
    contact: contact.trim(),
  });
  await sendMessage(chatId, botCopy.supportAskMessage);
}

async function handleSupportMessage(
  db: Supabase,
  chatId: number,
  user: TelegramUser,
  session: BotSession,
  message: string,
): Promise<void> {
  const supportChatId = process.env.SUPPORT_CHAT_ID;
  const product = session.selected_product;

  if (!supportChatId) {
    await sendMessage(chatId, botCopy.supportUnavailable, mainMenuKeyboard());
    await saveSession(db, user, { state: "idle" });
    return;
  }

  const supportText = [
    "Нове звернення до підтримки",
    `Курс: ${product ? PRODUCT_LABELS[product] : "не обрано"}`,
    `Telegram ID: ${user.id}`,
    `Username: ${user.username ? `@${user.username}` : "-"}`,
    `Контакт: ${session.contact ?? "-"}`,
    `Час: ${new Date().toISOString()}`,
    "",
    message.trim(),
  ].join("\n");

  const threadRaw = process.env.SUPPORT_THREAD_ID;
  const messageThreadId = threadRaw && /^\d+$/.test(threadRaw) ? Number(threadRaw) : null;
  await sendTelegramMessage(supportChatId, supportText, { messageThreadId });

  await logEventBestEffort(db, "tg_bot_support_requested", {
    telegram_user_id: String(user.id),
    telegram_username: user.username ?? null,
    product_code: product,
    contact: session.contact,
  }).catch(() => undefined);

  // The question itself, with the person stripped out, into the corpus the
  // assistant will be measured against. Deliberately NOT the event payload
  // above: that row identifies who wrote it, and the two must not be joinable.
  await captureQuestion({ text: message, source: "bot_support" });

  await saveSession(db, user, { state: "idle", contact: null });
  await sendMessage(chatId, botCopy.supportSent, backKeyboard());
}

async function handleBugMessage(db: Supabase, chatId: number, user: TelegramUser, message: string): Promise<void> {
  const supportChatId = process.env.SUPPORT_CHAT_ID;
  if (!supportChatId) {
    await sendMessage(chatId, botCopy.supportUnavailable, mainMenuKeyboard());
    return;
  }
  const threadRaw = process.env.BUG_REPORTS_THREAD_ID || process.env.SUPPORT_THREAD_ID;
  const messageThreadId = threadRaw && /^\d+$/.test(threadRaw) ? Number(threadRaw) : null;
  try {
    await sendTelegramMessage(
      supportChatId,
      [
        "Новий баг-репорт",
        `Telegram ID: ${user.id}`,
        `Username: ${user.username ? `@${user.username}` : "-"}`,
        `Час: ${new Date().toISOString()}`,
        "",
        message.trim(),
      ].join("\n"),
      { messageThreadId },
    );
  } catch {
    await sendMessage(chatId, botCopy.supportUnavailable, mainMenuKeyboard());
    return;
  }
  await logEventBestEffort(db, "tg_bot_bug_reported", {
    telegram_user_id: String(user.id),
    telegram_username: user.username ?? null,
  }).catch(() => undefined);
  await saveSession(db, user, { state: "idle" });
  await sendMessage(chatId, botCopy.bugSent, backKeyboard());
}

/**
 * Handles a `/start` payload issued by the dosha test's "send to Telegram".
 *
 * This is the cheap step the funnel was missing. It runs BEFORE the account
 * link reader because both payloads are opaque strings of the same shape, and
 * it answers for every verdict of its own tokens — an expired link is ours to
 * explain, not something to greet as a stranger.
 *
 * The chat that receives a result becomes a reachable contact even when there
 * is no account behind it: that, and not the finished test, is what a lead is.
 */
async function tryDeliverDoshaResult(
  db: Supabase,
  chatId: number,
  user: TelegramUser,
  payload: string,
): Promise<boolean> {
  const verdict = verifyDoshaResultToken(payload);

  if (!verdict.ok) {
    if (verdict.reason === "malformed") return false;
    await sendMessage(chatId, verdict.reason === "expired" ? botCopy.doshaResultExpired : botCopy.doshaResultBroken);
    return true;
  }

  const { data: attempt } = await db
    .from("test_attempts")
    .select("id, user_id, result_type, score_vata, score_pitta, score_kapha")
    .eq("id", verdict.attemptId)
    .maybeSingle();

  const resultType = (attempt?.result_type ?? null) as DoshaResultType | null;
  if (!attempt || !resultType) {
    await sendMessage(chatId, botCopy.doshaResultMissing);
    return true;
  }

  const scores = {
    vata: attempt.score_vata ?? 0,
    pitta: attempt.score_pitta ?? 0,
    kapha: attempt.score_kapha ?? 0,
  };
  const profile = classifyDosha(scores.vata, scores.pitta, scores.kapha);

  // The print first, captioned with the verdict alone; the reading follows as
  // text. If the photo is refused, sendTelegramCard sends the caption as text
  // and the result still arrives in full below it.
  await sendCaptionedPhoto(
    chatId,
    doshaCardUrl(resultType),
    `<b>${escapeTelegramHtml(profile.confidence === "low" ? RESULT_COPY[resultType].softTitle : RESULT_COPY[resultType].title)}</b>`,
  );
  await sendMessage(
    chatId,
    buildDoshaResultHtml({
      resultType,
      scores,
      intro: botCopy.doshaResultIntro,
      outro: botCopy.doshaResultOutro,
    }),
    {
      inline_keyboard: [
        [
          {
            text: botCopy.doshaResultNext,
            // A url button refuses a relative path outright, where the old
            // body link merely printed it — so absolutise, whatever the exit is.
            url: absoluteUrl(doshaExitHref(DOSHA_PRIMARY_EXIT, { resultType, confidence: profile.confidence })),
          },
        ],
        [{ text: "У меню", callback_data: "menu:back" }],
      ],
    },
  );

  await saveDoshaContact(db, user, { attemptUserId: attempt.user_id, resultType });
  await logEventBestEffort(db, "dosha_result_sent_to_telegram", {
    attempt_id: attempt.id,
    result_type: resultType,
    confidence: profile.confidence,
    telegram_user_id: String(user.id),
  }).catch(() => undefined);

  return true;
}

/**
 * Writes the chat down as a contact, and tags it with the result.
 *
 * An anonymous reader has no `auth_user_id` to hang a customer row on, so the
 * chat id is the identity: it is a real address, which is more than the funnel
 * had for them a moment ago. A reader who already has an account keeps that
 * row and simply gains the address.
 */
async function saveDoshaContact(
  db: Supabase,
  user: TelegramUser,
  params: { attemptUserId: string | null; resultType: DoshaResultType },
): Promise<void> {
  const tgId = String(user.id);
  const tags = ["test_completed", `dosha_${params.resultType}`];

  const { data: existing } = await db
    .from("customers")
    .select("id, tags")
    .or(params.attemptUserId ? `auth_user_id.eq.${params.attemptUserId},tg_id.eq.${tgId}` : `tg_id.eq.${tgId}`)
    .limit(1)
    .maybeSingle();

  if (existing?.id) {
    const merged = Array.from(new Set([...(Array.isArray(existing.tags) ? existing.tags : []), ...tags]));
    await db.from("customers").update({ tg_id: tgId, tg_username: user.username ?? null, tags: merged }).eq("id", existing.id);
    return;
  }

  await db.from("customers").insert({
    auth_user_id: params.attemptUserId,
    display_name: [user.first_name, user.last_name].filter(Boolean).join(" ") || user.username || null,
    tg_id: tgId,
    tg_username: user.username ?? null,
    tags,
  });
}

/**
 * Handles a `/start` payload issued by the cabinet's "connect Telegram" link.
 *
 * Returns false when the payload is not one of ours, so every other deep link
 * keeps its existing behaviour. Returns true once it has answered the user,
 * including for an expired or forged token — those are ours to explain.
 */
async function tryLinkAccount(db: Supabase, chatId: number, user: TelegramUser, payload: string): Promise<boolean> {
  const verdict = verifyTelegramLinkToken(payload);

  if (!verdict.ok) {
    if (verdict.reason === "malformed") return false;
    await sendMessage(chatId, verdict.reason === "expired" ? botCopy.linkExpired : botCopy.linkBroken);
    return true;
  }

  const { data: profile } = await db
    .from("platform_users")
    .select("email, full_name")
    .eq("auth_user_id", verdict.authUserId)
    .maybeSingle();

  const { data: existing } = await db
    .from("customers")
    .select("id")
    .eq("auth_user_id", verdict.authUserId)
    .limit(1)
    .maybeSingle();

  const tgId = String(user.id);

  // One chat belongs to one account: a chat previously linked elsewhere must
  // stop receiving that account's course reminders the moment it is re-linked.
  await db.from("customers").update({ tg_id: null }).eq("tg_id", tgId).neq("auth_user_id", verdict.authUserId);

  if (existing?.id) {
    await db.from("customers").update({ tg_id: tgId, tg_username: user.username ?? null }).eq("id", existing.id);
  } else {
    // A registered learner who asks to be notified becomes a contact even
    // without a purchase — otherwise there is no row to hold the address.
    await db.from("customers").insert({
      auth_user_id: verdict.authUserId,
      email: profile?.email ?? null,
      display_name: profile?.full_name ?? null,
      tg_id: tgId,
      tg_username: user.username ?? null,
    });
  }

  await saveSession(db, user, { state: "idle", contact: null });
  await sendMessage(chatId, botCopy.linkedOk, backKeyboard());
  return true;
}

/**
 * Handles a `/start` payload from the page after payment or from the receipt
 * (`lib/platform/orderTelegramLink.ts`). The token names an ORDER, so the
 * buyer is found through it without a sign-in: this is how a group buyer who
 * has not opened the course yet still hears «старт завтра».
 *
 * Writes the chat to the order's customer as `tg_id` — the address reminders
 * resolve through — and records it in `messaging_subscriptions` without
 * overwriting a row that is already there, so a chat that once unsubscribed
 * from mailings stays unsubscribed.
 */
async function tryLinkOrder(db: Supabase, chatId: number, user: TelegramUser, payload: string): Promise<boolean> {
  const verdict = verifyOrderTelegramToken(payload);

  if (!verdict.ok) {
    if (verdict.reason === "malformed") return false;
    await sendMessage(chatId, verdict.reason === "expired" ? botCopy.orderLinkExpired : botCopy.orderLinkBroken);
    return true;
  }

  const { data: order } = await db
    .from("orders")
    .select("id, order_ref, status, customer_id, offer_id, product_code, meta")
    .eq("id", verdict.orderId)
    .maybeSingle();

  if (!order?.customer_id) {
    await sendMessage(chatId, botCopy.orderLinkBroken);
    return true;
  }
  if (order.status !== "paid") {
    await sendMessage(chatId, botCopy.orderLinkUnpaid);
    return true;
  }

  const { data: customer } = await db
    .from("customers")
    .select("id, auth_user_id, display_name")
    .eq("id", order.customer_id)
    .maybeSingle();
  if (!customer) {
    await sendMessage(chatId, botCopy.orderLinkBroken);
    return true;
  }

  const tgId = String(user.id);

  // One chat belongs to one person, as in `tryLinkAccount`: another person's
  // row stops holding this chat. Rows of the same account keep it.
  const others = db.from("customers").update({ tg_id: null }).eq("tg_id", tgId).neq("id", customer.id);
  await (customer.auth_user_id ? others.or(`auth_user_id.is.null,auth_user_id.neq.${customer.auth_user_id}`) : others);
  await db.from("customers").update({ tg_id: tgId, tg_username: user.username ?? null }).eq("id", customer.id);

  const buyer = (order.meta as { buyer?: { name?: unknown } } | null)?.buyer;
  const name = customer.display_name ?? (typeof buyer?.name === "string" ? buyer.name : null);

  await db
    .from("messaging_subscriptions")
    .upsert(
      { channel: "telegram", address: tgId, customer_id: customer.id, name, source: "purchase" },
      { onConflict: "channel,address", ignoreDuplicates: true },
    );

  const { programTitle, cohortStartsOn } = await describeOrderOffer(db, order);

  // The stream's group (a personal link) and the channel, when they are not
  // joined yet: one message, one set of doors. The chat comes through the same
  // rule as «Чат потоку» (streamChatFor): a group offer moved to its next date
  // must not let last stream's receipt link into the new stream's group.
  const stream = await streamChatFor(db, tgId);
  const invite =
    stream && stream.offerId === order.offer_id
      ? await personalInvite({ chatId: stream.chatId, userId: user.id, name: order.order_ref })
      : null;
  const channel = await channelButton(user.id);
  const rows: InlineKeyboardMarkup["inline_keyboard"] = [[{ text: botCopy.orderLinkedButton, url: CABINET_URL }]];
  if (invite && "url" in invite) rows.push([{ text: botCopy.streamChatButton, url: invite.url }]);
  if (channel) rows.push([channel]);

  await saveSession(db, user, { state: "idle", contact: null });
  await sendMessage(chatId, orderLinkedHtml({ name, programTitle, cohortStartsOn, today: kyivDate(new Date()) }), {
    inline_keyboard: rows,
  });
  await logEventBestEffort(db, "tg_order_linked", {
    order_ref: order.order_ref,
    customer_id: customer.id,
    telegram_user_id: tgId,
  }).catch(() => undefined);
  return true;
}

/**
 * «Чат потоку» under the stream's «Завтра старт» and «День 1»: the person's own
 * one-use link, made when they tap, for whichever stream their chat holds.
 */
async function handleStreamChat(db: Supabase, chatId: number, user: TelegramUser): Promise<void> {
  const stream = await streamChatFor(db, String(user.id));
  if (!stream) {
    await sendMessage(chatId, botCopy.streamChatNotFound, backKeyboard());
    return;
  }
  const invite = await personalInvite({ chatId: stream.chatId, userId: user.id, name: `tg ${user.id}` });
  if (!invite) {
    await sendMessage(chatId, botCopy.streamChatMissing, backKeyboard());
    return;
  }
  if ("already" in invite) {
    await sendMessage(chatId, botCopy.streamChatAlready);
    return;
  }
  await sendMessage(chatId, botCopy.streamChatInvite, {
    inline_keyboard: [[{ text: botCopy.streamChatButton, url: invite.url }]],
  });
}

/** The program's name and, for a group stream, its shared start date. */
async function describeOrderOffer(
  db: Supabase,
  order: { offer_id: string | null; product_code: string },
): Promise<{ programTitle: string; cohortStartsOn: string | null }> {
  const known = assertProduct(order.product_code);
  const fallback = known ? PRODUCT_LABELS[known] : "CenterWay";
  if (!order.offer_id) return { programTitle: fallback, cohortStartsOn: null };

  const { data: offer } = await db
    .from("experience_offers")
    .select("format, cohort_starts_on, experience_id")
    .eq("id", order.offer_id)
    .maybeSingle();
  const { data: experience } = offer?.experience_id
    ? await db.from("experiences").select("title").eq("id", offer.experience_id).maybeSingle()
    : { data: null };

  return {
    programTitle: experience?.title ?? fallback,
    cohortStartsOn: offer?.format === "group" ? (offer.cohort_starts_on ?? null) : null,
  };
}

/** A group, supergroup or channel: anywhere the private menu must stay quiet. */
export function inGroup(chatType: string | undefined): boolean {
  return Boolean(chatType) && chatType !== "private";
}

/** `/connect`, bare or addressed to this bot — never to another bot in the same group. */
export function isConnectCommand(text: string): boolean {
  const match = /^\/connect(?:@(\w+))?$/i.exec(text.trim());
  if (!match) return false;
  return !match[1] || match[1].toLowerCase() === supportBotUsername().toLowerCase();
}

function supportBotUsername(): string {
  return SUPPORT_BOT_URL.split("/").pop() ?? "";
}

async function handleTextMessage(db: Supabase, message: TelegramMessage): Promise<void> {
  const user = message.from;
  const text = message.text?.trim();
  if (!user || !text) return;

  const chatId = message.chat.id;

  /* IN A GROUP THE BOT ONLY LISTENS FOR /connect. As an administrator of a
     stream's group it receives every message there, and the private-chat
     menu answering each of them would be the bot talking over the group. */
  if (inGroup(message.chat.type)) {
    // …and for a reply to a returned feed post's card in the work group: the
    // reason the author reads (src/lib/feed/telegram.ts).
    if (await handleFeedReply(db as unknown as FeedDb, message)) {
      await reactToTelegramMessage(chatId, message.message_id, "✍");
      return;
    }
    if (isConnectCommand(text)) await sendMessage(chatId, await connectStreamChat(db, message.chat, user.id));
    return;
  }

  if (text === "/start" || text.startsWith("/start ")) {
    // A deep link from the cabinet carries a signed account token. Anything
    // else — including the product bots' own payloads — falls through to the
    // greeting, so the sales path is untouched.
    const payload = text.slice("/start".length).trim();
    if (payload === "bug") {
      await saveSession(db, user, { state: "awaiting_bug_message", contact: null });
      await sendMessage(chatId, botCopy.bugAskMessage);
      return;
    }
    if (payload && (await tryDeliverDoshaResult(db, chatId, user, payload))) return;
    if (payload && (await tryLinkAccount(db, chatId, user, payload))) return;
    if (payload && (await tryLinkOrder(db, chatId, user, payload))) return;

    await saveSession(db, user, { state: "idle", contact: null });
    await sendGreeting(chatId);
    await sendMainMenu(chatId);
    return;
  }

  // The commands registered on the bot profile. Each is a shortcut into the
  // same branch its menu button opens — a command that answered differently
  // from the button with the same name would be a second bot.
  const command = text.startsWith("/") ? text.slice(1).split(/[@\s]/)[0] : null;
  if (command) {
    if (command === "courses") return handleMenuAction(db, chatId, user, "cabinet");
    if (command === "access") return handleMenuAction(db, chatId, user, "access");
    if (command === "help") return handleMenuAction(db, chatId, user, "faq");
    if (command === "support") return handleMenuAction(db, chatId, user, "support");
    if (command === "bug") return handleMenuAction(db, chatId, user, "bug");
    await sendMainMenu(chatId, botCopy.fallback);
    return;
  }

  const session = await getSession(db, user);

  // A reaction on the reader's own message is the acknowledgement Telegram
  // people already read: seen (👀) while a contact is checked, written down (✍)
  // when a request goes to support, thanked (🙏) for a bug. Only on messages
  // that START something — reacting to every line would be noise.
  if (session.state === "awaiting_access_lookup") {
    await reactToTelegramMessage(chatId, message.message_id, "👀");
    await handleAccessLookup(db, chatId, user, session, text);
    return;
  }

  if (session.state === "awaiting_support_contact") {
    await handleSupportContact(db, chatId, user, text);
    return;
  }

  if (session.state === "awaiting_support_message") {
    await reactToTelegramMessage(chatId, message.message_id, "✍");
    await handleSupportMessage(db, chatId, user, session, text);
    return;
  }
  if (session.state === "awaiting_bug_message") {
    await reactToTelegramMessage(chatId, message.message_id, "🙏");
    await handleBugMessage(db, chatId, user, text);
    return;
  }

  // Free text with no task running. Previously this fell into the product
  // picker, which read as the bot ignoring what was just typed.
  //
  // THIS IS THE MOST VALUABLE LINE IN THE FILE for the knowledge base: a person
  // typed a question, and the bot answered with a menu. Every one of these is a
  // question nothing on the platform answers, and until now each was discarded
  // the moment it was read.
  await captureQuestion({ text, source: "bot_fallback" });
  await sendMainMenu(chatId, botCopy.fallback);
}

async function handleCallbackQuery(db: Supabase, callbackQuery: TelegramCallbackQuery): Promise<void> {
  const data = callbackQuery.data ?? "";
  const chatId = callbackQuery.message?.chat.id;
  if (!chatId) return;

  // The feed's cards in the work group answer their own presses, with a line
  // the presser sees; they must never fall through to the private menu below.
  if (isFeedCallback(data)) {
    await handleFeedCallback(db as unknown as FeedDb, callbackQuery);
    return;
  }

  await answerCallbackQuery(callbackQuery.id);

  // Picking a course is a step of the access task and finishes that step —
  // it no longer parks the whole bot in a per-product mode.
  if (data.startsWith("product:")) {
    const product = assertProduct(data.split(":")[1]);
    if (!product) {
      await sendProductPicker(chatId);
      return;
    }

    await saveSession(db, callbackQuery.from, {
      selected_product: product,
      state: "awaiting_access_lookup",
      contact: null,
    });
    await sendMessage(chatId, botCopy.accessAskContact);
    return;
  }

  if (data === "streamchat") {
    await handleStreamChat(db, chatId, callbackQuery.from);
    return;
  }

  if (data.startsWith("menu:")) {
    await handleMenuAction(db, chatId, callbackQuery.from, data.slice("menu:".length));
    return;
  }

  if (data.startsWith("faq:")) {
    const key = data.slice("faq:".length) as FaqKey;
    // The question the reader pressed, repeated as the answer's bold lead: in a
    // scrolled chat the answer otherwise arrives without saying what it answers.
    const answered = key in botCopy.faq ? key : "other";
    await sendMessage(chatId, `<b>${botCopy.faqLabels[answered]}</b>\n\n${botCopy.faq[answered]}`, backKeyboard());
    return;
  }

  await sendMainMenu(chatId);
}

export async function handleTgSupportBotUpdate(update: TelegramUpdate): Promise<void> {
  const db = supabaseAdmin();

  try {
    if (update.message) {
      await handleTextMessage(db, update.message);
      return;
    }

    if (update.callback_query) {
      await handleCallbackQuery(db, update.callback_query);
    }
  } catch (error) {
    await logEventBestEffort(db, "tg_bot_error", {
      update_id: update.update_id,
      error: error instanceof Error ? error.message : String(error),
    }).catch(() => undefined);
    throw error;
  }
}

/** Re-exported: the bot's tests and callers read it from here. */
export { normalizeEmail };
