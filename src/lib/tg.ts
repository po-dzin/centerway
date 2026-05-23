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

export async function callTelegramBotApi<T>(
  method: string,
  payload: Record<string, unknown>
): Promise<T | null> {
  const token = requireTelegramToken(process.env.TELEGRAM_BOT_TOKEN, "TELEGRAM_BOT_TOKEN");
  return callTelegramBotApiWithToken(method, payload, token);
}

export async function sendTelegramMessage(
  chatId: number | string,
  text: string
): Promise<void> {
  await callTelegramBotApi("sendMessage", {
    chat_id: normalizeTelegramChatId(chatId),
    text,
    disable_web_page_preview: true,
  });
}

export async function sendTelegramMessageWithToken(
  token: string,
  chatId: number | string,
  text: string,
  options?: {
    messageThreadId?: number | null;
    parseMode?: "HTML" | "MarkdownV2";
  }
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
    requireTelegramToken(token, "custom telegram token")
  );
}
