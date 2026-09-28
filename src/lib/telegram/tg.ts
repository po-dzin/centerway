type TelegramApiResponse<T> = {
  ok: boolean;
  result?: T;
  description?: string;
};

function requireTelegramToken(token: string | undefined | null, envName: string): string {
  const value = token?.trim();
  if (!value) throw new Error(`Missing ${envName}`);
  return value;
}

function normalizeTelegramChatId(chatId: number | string): number | string {
  if (typeof chatId === "number") return chatId;
  const raw = chatId.trim();
  if (/^100\d{8,}$/.test(raw)) {
    return `-${raw}`;
  }
  return raw;
}

export async function callTelegramBotApiWithToken<T>(
  method: string,
  payload: Record<string, unknown>,
  token: string,
): Promise<T | null> {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const details = await response.text().catch(() => "");
    throw new Error(`Telegram ${method} failed: ${response.status} ${details}`);
  }

  const json = (await response.json().catch(() => null)) as TelegramApiResponse<T> | null;
  if (!json?.ok) {
    throw new Error(json?.description || `Telegram ${method} returned non-ok response`);
  }

  return json.result ?? null;
}

export async function callTelegramBotApi<T>(method: string, payload: Record<string, unknown>): Promise<T | null> {
  const token = requireTelegramToken(process.env.TELEGRAM_BOT_TOKEN, "TELEGRAM_BOT_TOKEN");
  return callTelegramBotApiWithToken(method, payload, token);
}

export async function sendTelegramMessage(
  chatId: number | string,
  text: string,
  options?: { messageThreadId?: number | null },
): Promise<void> {
  await callTelegramBotApi("sendMessage", {
    chat_id: normalizeTelegramChatId(chatId),
    text,
    disable_web_page_preview: true,
    ...(options?.messageThreadId ? { message_thread_id: options.messageThreadId } : {}),
  });
}

export async function sendTelegramMessageWithToken(
  token: string,
  chatId: number | string,
  text: string,
  options?: {
    messageThreadId?: number | null;
    parseMode?: "HTML" | "MarkdownV2";
  },
): Promise<void> {
  await callTelegramBotApiWithToken(
    "sendMessage",
    {
      chat_id: normalizeTelegramChatId(chatId),
      text,
      disable_web_page_preview: true,
      ...(options?.parseMode ? { parse_mode: options.parseMode } : {}),
      ...(options?.messageThreadId ? { message_thread_id: options.messageThreadId } : {}),
    },
    requireTelegramToken(token, "custom telegram token"),
  );
}

/* Telegram requires exactly one of these per button. `url` buttons matter: a
   link in a button opens in one tap, while the same link in the message body
   is a long blue string the reader has to aim at. */
export type InlineKeyboardButton =
  { text: string; callback_data: string; url?: never } | { text: string; url: string; callback_data?: never };

export type InlineKeyboardMarkup = {
  inline_keyboard: InlineKeyboardButton[][];
};

/** Escapes text for `parse_mode: "HTML"` — anything we did not write ourselves. */
export function escapeTelegramHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Telegram's caption cap. A plain message gets 4096; a photo caption does not. */
export const TELEGRAM_CAPTION_LIMIT = 1024;

/**
 * One message in the house format: HTML text, optional picture, optional
 * buttons.
 *
 * The picture is decoration and the text is the function, so a photo Telegram
 * refuses to fetch (a webp it does not like, a cold CDN, a caption past the
 * cap) degrades to the same text without it — never to silence.
 */
export async function sendTelegramCard(
  chatId: number | string,
  card: { html: string; photo?: string | null; replyMarkup?: InlineKeyboardMarkup },
): Promise<void> {
  const base = {
    chat_id: normalizeTelegramChatId(chatId),
    parse_mode: "HTML",
    ...(card.replyMarkup ? { reply_markup: card.replyMarkup } : {}),
  };

  if (card.photo && card.html.length <= TELEGRAM_CAPTION_LIMIT) {
    try {
      await callTelegramBotApi("sendPhoto", { ...base, photo: card.photo, caption: card.html });
      return;
    } catch {
      // Fall through to the text form.
    }
  }

  await callTelegramBotApi("sendMessage", { ...base, text: card.html, disable_web_page_preview: true });
}

/**
 * The small signs of a live counterpart: «друкує…» while the bot works, a
 * reaction on the message it has taken. Best-effort by design — a chat that
 * misses a reaction has lost nothing, a webhook that throws over one has.
 */
export async function sendTelegramChatAction(
  chatId: number | string,
  action: "typing" | "upload_photo" = "typing",
): Promise<void> {
  await callTelegramBotApi("sendChatAction", { chat_id: normalizeTelegramChatId(chatId), action }).catch(
    () => undefined,
  );
}

export async function reactToTelegramMessage(chatId: number | string, messageId: number, emoji: string): Promise<void> {
  await callTelegramBotApi("setMessageReaction", {
    chat_id: normalizeTelegramChatId(chatId),
    message_id: messageId,
    reaction: [{ type: "emoji", emoji }],
  }).catch(() => undefined);
}
