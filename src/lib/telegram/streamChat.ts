/**
 * The stream's Telegram group and the public channel, handed out by the bot.
 *
 * G (15.10): the stream chat link goes only to the stream's own buyers, it
 * always points at the CURRENT stream's group, and the channel is offered to
 * anyone who is not in it yet. Until now one static link sat in an env variable
 * (TELEGRAM_STREAM_CHAT_URL): swapped by hand every stream, and open to anyone
 * it was forwarded to.
 *
 * HOW A GROUP BECOMES A STREAM'S. An admin of the group adds the bot as an
 * administrator with the right to add members and sends /connect there; the
 * group lands in `telegram_stream_chats`. The builder picks it for a group
 * format (`experience_offers.stream_chat_id`), and changing the format's start
 * date clears the pick — a new date is a new stream until its chat is chosen.
 *
 * HOW A BUYER GETS IN. A personal invite link for ONE person, created on the
 * spot (`createChatInviteLink`, member_limit 1). Forwarded, it lets in at most
 * one person and is then spent; nobody has to approve requests by hand.
 */

import { startedEarlier } from "@/lib/email/lifecycleRuns";
import type { Database } from "@/lib/db/database.types";
import type { SupabaseClient } from "@supabase/supabase-js";

import { callTelegramBotApi, type InlineKeyboardMarkup } from "./tg";

type Db = SupabaseClient<Database>;
type Button = InlineKeyboardMarkup["inline_keyboard"][number][number];

/** The public channel (G 15.10). `TELEGRAM_CHANNEL` moves it without a deploy of code. */
export function channelHandle(): string {
  return process.env.TELEGRAM_CHANNEL?.trim() || "@cway_flow";
}

export function channelUrl(): string {
  return process.env.TELEGRAM_CHANNEL_URL?.trim() || `https://t.me/${channelHandle().replace(/^@/, "")}`;
}

/** What `getChatMember` answers for someone who is in. `restricted` is in, with limits. */
export function statusIsIn(status: string | undefined | null): boolean {
  return status === "creator" || status === "administrator" || status === "member" || status === "restricted";
}

/**
 * Is this person in that chat? `null` when the bot cannot tell — it is not an
 * admin there, or Telegram refused — and the caller then offers the way in
 * rather than hiding it.
 */
export async function isMember(chat: number | string, userId: number): Promise<boolean | null> {
  try {
    const member = await callTelegramBotApi<{ status?: string; is_member?: boolean }>("getChatMember", {
      chat_id: chat,
      user_id: userId,
    });
    if (!member) return null;
    return member.status === "restricted" ? member.is_member === true : statusIsIn(member.status);
  } catch {
    return null;
  }
}

/** «Канал CenterWay», unless the person is already there. */
export async function channelButton(userId: number): Promise<Button | null> {
  if ((await isMember(channelHandle(), userId)) === true) return null;
  return { text: "Канал CenterWay", url: channelUrl() };
}

/**
 * A link into the stream chat for ONE person. `already` when they are in;
 * null when the bot may not invite there (it lost its admin right).
 */
export async function personalInvite(input: {
  chatId: number;
  userId: number;
  /** Shown to the chat's admins beside the link: whose it was. */
  name: string;
  now?: number;
}): Promise<{ url: string } | { already: true } | null> {
  if ((await isMember(input.chatId, input.userId)) === true) return { already: true };
  try {
    const link = await callTelegramBotApi<{ invite_link?: string }>("createChatInviteLink", {
      chat_id: input.chatId,
      member_limit: 1,
      // A week: long enough to tap from the welcome, short enough not to linger.
      expire_date: Math.floor((input.now ?? Date.now()) / 1000) + 7 * 24 * 3600,
      name: input.name.slice(0, 32),
    });
    return link?.invite_link ? { url: link.invite_link } : null;
  } catch {
    return null;
  }
}

export type StreamOfferChat = {
  offerId: string;
  chatId: number;
  cohortStartsOn: string;
};

/**
 * Of the group streams a person holds, the one whose chat to open: the latest
 * start. Pure. A stream that ended long ago still opens its chat — the group
 * stays the alumni's room — but a newer one wins.
 */
export function pickStream(candidates: StreamOfferChat[]): StreamOfferChat | null {
  return [...candidates].sort((a, b) => b.cohortStartsOn.localeCompare(a.cohortStartsOn))[0] ?? null;
}

/**
 * The stream chat a Telegram user may enter, found through the chat they linked
 * (`customers.tg_id`): a paid order of a group format with a chat, or a granted
 * seat (an enrollment carrying that format's start date).
 *
 * A group offer is reused from season to season by moving its date, so a paid
 * order alone also matches every later stream. Whoever already got a «День 1»
 * for an earlier date has had their stream — the same rule the stream letters
 * use (`startedEarlier`).
 */
export async function streamChatFor(db: Db, tgId: string): Promise<StreamOfferChat | null> {
  const { data: customers } = await db.from("customers").select("id, email, auth_user_id").eq("tg_id", tgId);
  if (!customers?.length) return null;

  const { data: offers } = await db
    .from("experience_offers")
    .select("id, cohort_starts_on, stream_chat_id")
    .eq("format", "group")
    .not("stream_chat_id", "is", null)
    .not("cohort_starts_on", "is", null);
  if (!offers?.length) return null;

  const customerIds = customers.map((row) => row.id);
  const authIds = customers.map((row) => row.auth_user_id).filter((id): id is string => Boolean(id));
  const emails = customers.map((row) => row.email?.trim().toLowerCase()).filter((e): e is string => Boolean(e));

  const [{ data: orders }, { data: seats }] = await Promise.all([
    db
      .from("orders")
      .select("offer_id")
      .eq("status", "paid")
      .in("customer_id", customerIds)
      .in(
        "offer_id",
        offers.map((offer) => offer.id),
      ),
    authIds.length
      ? db
          .from("lms_enrollments")
          .select("cohort_starts_on")
          .in("auth_user_id", authIds)
          .eq("status", "active")
          .not("cohort_starts_on", "is", null)
      : Promise.resolve({ data: [] as Array<{ cohort_starts_on: string | null }> }),
  ]);

  const bought = new Set((orders ?? []).map((row) => row.offer_id as string));
  const seatDates = new Set((seats ?? []).map((row) => row.cohort_starts_on as string));
  const candidates: StreamOfferChat[] = [];
  for (const offer of offers) {
    const date = offer.cohort_starts_on as string;
    const viaSeat = seatDates.has(date);
    if (!viaSeat && !bought.has(offer.id)) continue;
    if (!viaSeat) {
      const started = await startedEarlier(date);
      if (emails.some((email) => started.has(email))) continue;
    }
    candidates.push({ offerId: offer.id, chatId: offer.stream_chat_id as number, cohortStartsOn: date });
  }
  return pickStream(candidates);
}

/** The stream chat of one order, when its format has one. */
export async function streamChatOfOffer(db: Db, offerId: string | null): Promise<number | null> {
  if (!offerId) return null;
  const { data } = await db.from("experience_offers").select("format, stream_chat_id").eq("id", offerId).maybeSingle();
  return data?.format === "group" && data.stream_chat_id ? Number(data.stream_chat_id) : null;
}

/**
 * /connect, sent in a group by one of its admins: the group becomes pickable
 * in the builder. Answers in the group, in words its admin can act on.
 */
export async function connectStreamChat(db: Db, chat: { id: number; title?: string }, userId: number): Promise<string> {
  const [sender, botSelf] = await Promise.all([
    callTelegramBotApi<{ status?: string }>("getChatMember", { chat_id: chat.id, user_id: userId }).catch(() => null),
    callTelegramBotApi<{ id: number }>("getMe", {}).catch(() => null),
  ]);
  if (sender?.status !== "creator" && sender?.status !== "administrator") {
    return "Підключити чат може тільки адміністратор цієї групи.";
  }
  const bot = botSelf
    ? await callTelegramBotApi<{ status?: string; can_invite_users?: boolean }>("getChatMember", {
        chat_id: chat.id,
        user_id: botSelf.id,
      }).catch(() => null)
    : null;
  const canInvite = bot?.status === "administrator" && bot.can_invite_users === true;

  const { error } = await db.from("telegram_stream_chats").upsert(
    {
      chat_id: chat.id,
      title: chat.title?.trim() || String(chat.id),
      bot_can_invite: canInvite,
      connected_by: String(userId),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "chat_id" },
  );
  if (error) return "Не вдалося зберегти чат. Спробуйте ще раз трохи згодом.";

  return canInvite
    ? "Чат підключено ✓ Оберіть його в конструкторі у формату потоку — і бот видаватиме покупцям особисті посилання сюди."
    : "Чат записано, але я не можу запрошувати учасників. Зробіть мене адміністратором із правом «Додавати учасників» і надішліть /connect ще раз.";
}
