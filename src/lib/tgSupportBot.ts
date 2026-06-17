import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { ProductCode } from "@/lib/products";
import { callTelegramBotApi, sendTelegramMessage } from "@/lib/tg";

type Supabase = ReturnType<typeof supabaseAdmin>;
type BotProductCode = Extract<ProductCode, "short" | "irem">;

type BotState =
  | "idle"
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

type InlineKeyboardButton = {
  text: string;
  callback_data: string;
};

type InlineKeyboardMarkup = {
  inline_keyboard: InlineKeyboardButton[][];
};

const PRODUCT_LABELS: Record<BotProductCode, string> = {
  short: "Short Reboot",
  irem: "IREM",
};

const FAQ_ANSWERS: Record<string, string> = {
  access_missing:
    "Если доступ не пришел, нажмите «Получить доступ» и введите email или телефон, который использовали при оплате.",
  login:
    "Если бот/продукт не открывается, проверьте, что Telegram открыт в вашем аккаунте, и попробуйте перейти по ссылке еще раз.",
  materials:
    "Материалы находятся внутри бота продукта. После подтверждения оплаты я пришлю ссылку на нужный бот.",
  check_payment:
    "Для проверки оплаты нажмите «Получить доступ» и отправьте email или номер телефона из заказа.",
  payment_problem:
    "Если оплата списалась, но доступ не найден, создайте обращение в поддержку. Приложите email/телефон и, если есть, номер платежа.",
  other:
    "Если вопрос не подходит под разделы FAQ, нажмите «Связаться с поддержкой» и опишите ситуацию.",
};

function assertProduct(value: string | null | undefined): BotProductCode | null {
  if (value === "short" || value === "reboot") return "short";
  return value === "irem" ? value : null;
}

function accessLink(product: BotProductCode): string {
  if (product === "short") {
    return (
      process.env.SHORT_ACCESS_LINK ||
      "https://t.me/ShortRebotBot?start=6a1b2e01f73e6df7570fff07"
    );
  }
  return (
    process.env.IREM_ACCESS_LINK ||
    "https://t.me/IREM_gymnastic_Bot?start=ZGw6MjA1MTY4"
  );
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

function productKeyboard(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: "Short Reboot", callback_data: "product:short" },
        { text: "IREM", callback_data: "product:irem" },
      ],
    ],
  };
}

function mainMenuKeyboard(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [{ text: "Получить доступ", callback_data: "menu:access" }],
      [{ text: "Частые вопросы", callback_data: "menu:faq" }],
      [{ text: "Проблема с оплатой", callback_data: "menu:payment_problem" }],
      [{ text: "Связаться с поддержкой", callback_data: "menu:support" }],
      [{ text: "Сменить курс", callback_data: "menu:change_product" }],
    ],
  };
}

function faqKeyboard(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [{ text: "Не пришел доступ", callback_data: "faq:access_missing" }],
      [{ text: "Не могу войти", callback_data: "faq:login" }],
      [{ text: "Где материалы", callback_data: "faq:materials" }],
      [{ text: "Как проверить оплату", callback_data: "faq:check_payment" }],
      [{ text: "Проблема с оплатой", callback_data: "faq:payment_problem" }],
      [{ text: "Другое", callback_data: "faq:other" }],
      [{ text: "Назад", callback_data: "menu:back" }],
    ],
  };
}

function retryKeyboard(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [{ text: "Попробовать еще раз", callback_data: "menu:access" }],
      [{ text: "Связаться с поддержкой", callback_data: "menu:support" }],
    ],
  };
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
  await sendMessage(chatId, "Какой курс вас интересует?", productKeyboard());
}

async function sendMainMenu(
  chatId: number,
  product: BotProductCode
): Promise<void> {
  await sendMessage(
    chatId,
    `Выбран курс: ${PRODUCT_LABELS[product]}\nЧто нужно сделать?`,
    mainMenuKeyboard()
  );
}

async function handleMenuAction(
  db: Supabase,
  chatId: number,
  user: TelegramUser,
  session: BotSession,
  action: string
): Promise<void> {
  if (action === "change_product") {
    await saveSession(db, user, {
      selected_product: null,
      state: "idle",
      contact: null,
    });
    await sendProductPicker(chatId);
    return;
  }

  if (!session.selected_product) {
    await sendProductPicker(chatId);
    return;
  }

  if (action === "back") {
    await saveSession(db, user, { state: "idle" });
    await sendMainMenu(chatId, session.selected_product);
    return;
  }

  if (action === "access") {
    await saveSession(db, user, {
      selected_product: session.selected_product,
      state: "awaiting_access_lookup",
      contact: null,
    });
    await sendMessage(
      chatId,
      "Введите email или номер телефона, который использовали при оплате."
    );
    return;
  }

  if (action === "faq") {
    await saveSession(db, user, { state: "idle" });
    await sendMessage(chatId, "Выберите вопрос:", faqKeyboard());
    return;
  }

  if (action === "payment_problem" || action === "support") {
    await saveSession(db, user, {
      selected_product: session.selected_product,
      state: "awaiting_support_contact",
      contact: null,
    });
    await sendMessage(
      chatId,
      "Отправьте email или телефон, по которому поддержка сможет найти оплату."
    );
    return;
  }

  await sendMainMenu(chatId, session.selected_product);
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
    await sendMessage(
      chatId,
      `Оплата найдена. Вот ссылка на доступ:\n${accessLink(session.selected_product)}`,
      mainMenuKeyboard()
    );
    return;
  }

  await sendMessage(
    chatId,
    "Не нашли оплату по этим данным. Проверьте email/телефон или создайте обращение в поддержку.",
    retryKeyboard()
  );
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
  await sendMessage(chatId, "Опишите проблему одним сообщением.");
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
    await sendMessage(
      chatId,
      "Поддержка временно не настроена. Попробуйте позже.",
      mainMenuKeyboard()
    );
    await saveSession(db, user, { state: "idle" });
    return;
  }

  const supportText = [
    "Новая заявка поддержки",
    `Курс: ${product ? PRODUCT_LABELS[product] : "не выбран"}`,
    `Telegram ID: ${user.id}`,
    `Username: ${user.username ? `@${user.username}` : "-"}`,
    `Контакт: ${session.contact ?? "-"}`,
    `Время: ${new Date().toISOString()}`,
    "",
    message.trim(),
  ].join("\n");

  await sendMessage(supportChatId, supportText);

  await logEventBestEffort(db, "tg_bot_support_requested", {
    telegram_user_id: String(user.id),
    telegram_username: user.username ?? null,
    product_code: product,
    contact: session.contact,
  }).catch(() => undefined);

  await saveSession(db, user, { state: "idle", contact: null });
  await sendMessage(
    chatId,
    "Передали обращение в поддержку. Специалист ответит вам в Telegram.",
    product ? mainMenuKeyboard() : undefined
  );
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
    await saveSession(db, user, { state: "idle", contact: null });
    await sendProductPicker(chatId);
    return;
  }

  const session = await getSession(db, user);

  if (!session.selected_product) {
    await sendProductPicker(chatId);
    return;
  }

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

  await sendMainMenu(chatId, session.selected_product);
}

async function handleCallbackQuery(
  db: Supabase,
  callbackQuery: TelegramCallbackQuery
): Promise<void> {
  const data = callbackQuery.data ?? "";
  const chatId = callbackQuery.message?.chat.id;
  if (!chatId) return;

  await answerCallbackQuery(callbackQuery.id);

  if (data.startsWith("product:")) {
    const product = assertProduct(data.split(":")[1]);
    if (!product) {
      await sendProductPicker(chatId);
      return;
    }

    await saveSession(db, callbackQuery.from, {
      selected_product: product,
      state: "idle",
      contact: null,
    });
    await sendMainMenu(chatId, product);
    return;
  }

  const session = await getSession(db, callbackQuery.from);

  if (data.startsWith("menu:")) {
    await handleMenuAction(
      db,
      chatId,
      callbackQuery.from,
      session,
      data.slice("menu:".length)
    );
    return;
  }

  if (data.startsWith("faq:")) {
    const key = data.slice("faq:".length);
    await sendMessage(
      chatId,
      FAQ_ANSWERS[key] ?? FAQ_ANSWERS.other,
      mainMenuKeyboard()
    );
    return;
  }

  if (session.selected_product) {
    await sendMainMenu(chatId, session.selected_product);
  } else {
    await sendProductPicker(chatId);
  }
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
