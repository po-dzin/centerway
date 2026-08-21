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
import type { ProductCode } from "@/lib/products";
import { callTelegramBotApi, sendTelegramMessage } from "@/lib/tg";
import { verifyTelegramLinkToken } from "@/lib/platform/telegramLink";
import { botCopy, CABINET_URL } from "@/lib/tgSupportBotCopy";

type Supabase = ReturnType<typeof supabaseAdmin>;
type BotProductCode = Extract<ProductCode, "short" | "irem" | "way21" | "reset-day">;

type BotState =
  | "idle"
  /* The picker is now a step inside the access task, so the bot has to remember
     that it is mid-task while the buttons are on screen. */
  | "choosing_product_access"
  | "awaiting_access_lookup"
  | "awaiting_support_contact"
  | "awaiting_support_message";

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
};

type TelegramMessage = {
  message_id: number;
  text?: string;
  chat: TelegramChat;
  from?: TelegramUser;
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

/* Telegram requires exactly one of these per button. `url` buttons matter here:
   the cabinet is a web page, and a url button opens it directly instead of
   making the reader long-press a link in the message body. */
type InlineKeyboardButton =
  | { text: string; callback_data: string; url?: never }
  | { text: string; url: string; callback_data?: never };

type InlineKeyboardMarkup = {
  inline_keyboard: InlineKeyboardButton[][];
};

export const PRODUCT_LABELS: Record<BotProductCode, string> = {
  short: "Шот",
  irem: "IREM",
  way21: "Шлях 21",
  "reset-day": "Легкий день",
};

/**
 * Where a paid learner is actually sent.
 *
 * `platform` — the course runs in the LMS; access is the cabinet, and there is
 * nothing to hand over but a link and the reason it might look empty (wrong
 * sign-in address). `bot` — one of the two legacy programs that still live in
 * their own Telegram bot.
 */
type Delivery = { kind: "platform"; courseSlug: string } | { kind: "bot" };

export type FaqKey = keyof typeof botCopy.faq;

export const PRODUCT_DELIVERY: Record<BotProductCode, Delivery> = {
  short: { kind: "bot" },
  irem: { kind: "bot" },
  way21: { kind: "platform", courseSlug: "way21" },
  "reset-day": { kind: "platform", courseSlug: "reset-day" },
};


export function assertProduct(value: string | null | undefined): BotProductCode | null {
  if (value === "short" || value === "reboot") return "short";
  if (value === "irem") return "irem";
  if (value === "way21" || value === "shlyah21" || value === "detox21") return "way21";
  if (
    value === "reset-day" ||
    value === "reset_day" ||
    value === "reset" ||
    value === "rozvantazhennya"
  ) {
    return "reset-day";
  }
  return null;
}

// Direct course-bot deep link, when the program has its own bot. way21 and
// reset-day have no dedicated bot yet (direct links land here once ready via
// WAY21_ACCESS_LINK / RESET_DAY_ACCESS_LINK) — until then access is delivered
// by support, so accessLink returns null and the caller shows a graceful note.
function accessLink(product: BotProductCode): string | null {
  if (product === "short") {
    return (
      process.env.SHORT_ACCESS_LINK ||
      "https://telegram.me/ShortRebotBot?start=6a1b2e01f73e6df7570fff07"
    );
  }
  if (product === "irem") {
    return (
      process.env.IREM_ACCESS_LINK ||
      "https://telegram.me/IREM_gymnastic_Bot?start=ZGw6MjA1MTY4"
    );
  }
  if (product === "way21") return process.env.WAY21_ACCESS_LINK || null;
  return process.env.RESET_DAY_ACCESS_LINK || null;
}

export function normalizeEmail(input: string): string | null {
  const value = input.trim().toLowerCase();
  if (!value || !value.includes("@")) return null;
  return value;
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

/* Ordered by how often it is the reason someone opened the bot. "Мої курси"
   first, because for a paying learner the answer is almost always "it is in the
   cabinet" — and that answer costs one tap instead of a payment lookup. */
function mainMenuKeyboard(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [{ text: "Мої курси", callback_data: "menu:cabinet" }],
      [{ text: "Не бачу доступ", callback_data: "menu:access" }],
      [{ text: "Часті питання", callback_data: "menu:faq" }],
      [{ text: "Написати підтримці", callback_data: "menu:support" }],
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

async function sendMessage(
  chatId: number | string,
  text: string,
  replyMarkup?: InlineKeyboardMarkup
): Promise<void> {
  if (!replyMarkup) {
    await sendTelegramMessage(chatId, text);
    return;
  }

  await callTelegramBotApi("sendMessage", {
    chat_id: chatId,
    text,
    disable_web_page_preview: true,
    reply_markup: replyMarkup,
  });
}

async function answerCallbackQuery(callbackQueryId: string): Promise<void> {
  await callTelegramBotApi("answerCallbackQuery", {
    callback_query_id: callbackQueryId,
  });
}

async function getSession(
  db: Supabase,
  user: TelegramUser
): Promise<BotSession> {
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
  patch: Partial<Omit<BotSession, "telegram_user_id">>
): Promise<void> {
  const payload = {
    telegram_user_id: String(user.id),
    telegram_username: user.username ?? null,
    ...patch,
  };

  const { error } = await db
    .from("support_bot_sessions")
    .upsert(payload, { onConflict: "telegram_user_id" });
  if (error) throw error;
}

async function logEventBestEffort(
  db: Supabase,
  type: string,
  payload: Record<string, unknown>
): Promise<void> {
  await db.from("events").insert({ type, order_ref: null, payload });
}

async function findPaidOrder(
  db: Supabase,
  product: BotProductCode,
  contact: string
): Promise<boolean> {
  const email = normalizeEmail(contact);
  const phoneVariants = phoneLookupVariants(contact);
  const customerIds = new Set<string>();

  if (email) {
    const { data, error } = await db
      .from("customers")
      .select("id")
      .eq("email", email)
      .limit(20);
    if (error) throw error;
    for (const row of data ?? []) {
      if (row.id) customerIds.add(String(row.id));
    }
  }

  if (phoneVariants.length > 0) {
    const { data, error } = await db
      .from("customers")
      .select("id")
      .in("phone", phoneVariants)
      .limit(20);
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

async function sendProductPicker(chatId: number): Promise<void> {
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
async function handleMenuAction(
  db: Supabase,
  chatId: number,
  user: TelegramUser,
  action: string
): Promise<void> {
  if (action === "back") {
    await saveSession(db, user, { state: "idle", contact: null });
    await sendMainMenu(chatId);
    return;
  }

  if (action === "cabinet") {
    await saveSession(db, user, { state: "idle", contact: null });
    await sendMessage(chatId, botCopy.cabinet, backKeyboard());
    return;
  }

  if (action === "access") {
    await saveSession(db, user, { state: "choosing_product_access", contact: null });
    await sendProductPicker(chatId);
    return;
  }

  if (action === "faq") {
    await saveSession(db, user, { state: "idle" });
    await sendMessage(chatId, botCopy.faqPrompt, faqKeyboard());
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
    await sendMessage(chatId, botCopy.supportAskContact);
    return;
  }

  await sendMainMenu(chatId);
}

async function handleAccessLookup(
  db: Supabase,
  chatId: number,
  user: TelegramUser,
  session: BotSession,
  contact: string
): Promise<void> {
  if (!session.selected_product) {
    await saveSession(db, user, { state: "idle", contact: null });
    await sendProductPicker(chatId);
    return;
  }

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
 * What "you have access" means depends on where the course runs.
 *
 * For a platform course there is no secret link to hand over — the course is
 * simply in the cabinet — so the useful answer is the cabinet plus the one
 * thing that makes it look empty when it is not: signing in with a different
 * address than the order was placed on.
 */
async function sendAccessAnswer(chatId: number, product: BotProductCode): Promise<void> {
  const title = PRODUCT_LABELS[product];
  const delivery = PRODUCT_DELIVERY[product];

  if (delivery.kind === "platform") {
    await sendMessage(chatId, botCopy.accessFoundPlatform(title), {
      inline_keyboard: [
        [{ text: "Відкрити кабінет", url: CABINET_URL }],
        [{ text: "У меню", callback_data: "menu:back" }],
      ],
    });
    return;
  }

  const link = accessLink(product);
  if (!link) {
    await sendMessage(chatId, botCopy.accessFoundNoTarget(title), {
      inline_keyboard: [
        [{ text: "Написати підтримці", callback_data: "menu:support" }],
        [{ text: "У меню", callback_data: "menu:back" }],
      ],
    });
    return;
  }

  await sendMessage(chatId, botCopy.accessFoundBot(title), {
    inline_keyboard: [
      [{ text: `Відкрити «${title}»`, url: link }],
      [{ text: "У меню", callback_data: "menu:back" }],
    ],
  });
}

async function handleSupportContact(
  db: Supabase,
  chatId: number,
  user: TelegramUser,
  contact: string
): Promise<void> {
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
  message: string
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

  await saveSession(db, user, { state: "idle", contact: null });
  await sendMessage(chatId, botCopy.supportSent, backKeyboard());
}

/**
 * Handles a `/start` payload issued by the cabinet's "connect Telegram" link.
 *
 * Returns false when the payload is not one of ours, so every other deep link
 * keeps its existing behaviour. Returns true once it has answered the user,
 * including for an expired or forged token — those are ours to explain.
 */
async function tryLinkAccount(
  db: Supabase,
  chatId: number,
  user: TelegramUser,
  payload: string
): Promise<boolean> {
  const verdict = verifyTelegramLinkToken(payload);

  if (!verdict.ok) {
    if (verdict.reason === "malformed") return false;
    await sendMessage(
      chatId,
      verdict.reason === "expired" ? botCopy.linkExpired : botCopy.linkBroken
    );
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
    await db.from("customers").update({ tg_id: tgId }).eq("id", existing.id);
  } else {
    // A registered learner who asks to be notified becomes a contact even
    // without a purchase — otherwise there is no row to hold the address.
    await db.from("customers").insert({
      auth_user_id: verdict.authUserId,
      email: profile?.email ?? null,
      display_name: profile?.full_name ?? null,
      tg_id: tgId,
    });
  }

  await saveSession(db, user, { state: "idle", contact: null });
  await sendMessage(chatId, botCopy.linkedOk, backKeyboard());
  return true;
}

async function handleTextMessage(
  db: Supabase,
  message: TelegramMessage
): Promise<void> {
  const user = message.from;
  const text = message.text?.trim();
  if (!user || !text) return;

  const chatId = message.chat.id;

  if (text === "/start" || text.startsWith("/start ")) {
    // A deep link from the cabinet carries a signed account token. Anything
    // else — including the product bots' own payloads — falls through to the
    // greeting, so the sales path is untouched.
    const payload = text.slice("/start".length).trim();
    if (payload && (await tryLinkAccount(db, chatId, user, payload))) return;

    await saveSession(db, user, { state: "idle", contact: null });
    await sendMessage(chatId, botCopy.greeting);
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
    await sendMainMenu(chatId, botCopy.fallback);
    return;
  }

  const session = await getSession(db, user);

  if (session.state === "awaiting_access_lookup") {
    await handleAccessLookup(db, chatId, user, session, text);
    return;
  }

  if (session.state === "awaiting_support_contact") {
    await handleSupportContact(db, chatId, user, text);
    return;
  }

  if (session.state === "awaiting_support_message") {
    await handleSupportMessage(db, chatId, user, session, text);
    return;
  }

  // Free text with no task running. Previously this fell into the product
  // picker, which read as the bot ignoring what was just typed.
  await sendMainMenu(chatId, botCopy.fallback);
}

async function handleCallbackQuery(
  db: Supabase,
  callbackQuery: TelegramCallbackQuery
): Promise<void> {
  const data = callbackQuery.data ?? "";
  const chatId = callbackQuery.message?.chat.id;
  if (!chatId) return;

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

  if (data.startsWith("menu:")) {
    await handleMenuAction(db, chatId, callbackQuery.from, data.slice("menu:".length));
    return;
  }

  if (data.startsWith("faq:")) {
    const key = data.slice("faq:".length) as FaqKey;
    await sendMessage(chatId, botCopy.faq[key] ?? botCopy.faq.other, backKeyboard());
    return;
  }

  await sendMainMenu(chatId);
}

export async function handleTgSupportBotUpdate(
  update: TelegramUpdate
): Promise<void> {
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
