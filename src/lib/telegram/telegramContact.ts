/**
 * A Telegram contact a person can actually be found by (owner, 2026-10-22).
 *
 * `customers.tg_id` is Telegram's numeric user id: stable, but nobody can
 * search for it. The handle lives elsewhere: the support bot keeps the
 * `@username` it last saw in `support_bot_sessions`, and the bot can ask
 * Telegram for the current one with `getChat` for anyone who has started it.
 * Not every account has a username; then the id is still the address, and
 * `tg://user?id=` opens that person in the Telegram app.
 */

import { adminClient } from "@/lib/auth/adminClient";
import { callTelegramBotApi } from "./tg";

export type TelegramContact = {
  id: string;
  username: string | null;
  name: string | null;
};

type Db = ReturnType<typeof adminClient>;

const LOOKUP_TIMEOUT_MS = 2500;

export function cleanTelegramUsername(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const handle = raw.trim().replace(/^@/, "");
  return handle.length > 0 ? handle : null;
}

async function askTelegram(id: string): Promise<{ username: string | null; name: string | null } | null> {
  if (!process.env.TELEGRAM_BOT_TOKEN) return null;
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), LOOKUP_TIMEOUT_MS));
  const chat = callTelegramBotApi<{ username?: string; first_name?: string; last_name?: string }>("getChat", {
    chat_id: id,
  }).catch(() => null);
  const found = await Promise.race([chat, timeout]);
  if (!found) return null;
  const name = [found.first_name, found.last_name].filter(Boolean).join(" ").trim();
  return { username: cleanTelegramUsername(found.username), name: name || null };
}

export async function resolveTelegramContact(db: Db, tgId: unknown): Promise<TelegramContact | null> {
  const id = typeof tgId === "string" || typeof tgId === "number" ? String(tgId).trim() : "";
  if (!id) return null;

  const { data } = await db
    .from("support_bot_sessions")
    .select("telegram_username")
    .eq("telegram_user_id", id)
    .maybeSingle();
  const stored = cleanTelegramUsername(data?.telegram_username);
  if (stored) return { id, username: stored, name: null };

  const live = await askTelegram(id);
  return { id, username: live?.username ?? null, name: live?.name ?? null };
}
