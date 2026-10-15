-- 2026-10-15 · The Telegram group of each group stream
--
-- G (15.10): the stream chat link goes out through the support bot, only to
-- buyers of the stream, and must always point at the CURRENT stream's group.
-- Until now one static link sat in an env variable (TELEGRAM_STREAM_CHAT_URL)
-- and had to be swapped by hand every stream; anyone it was forwarded to could
-- join.
--
-- `telegram_stream_chats` holds the groups the bot was connected to: an admin
-- of the group adds @centerway_support_bot as an administrator with the right
-- to add members and sends /connect there. The builder then picks one of them
-- for a group format (`experience_offers.stream_chat_id`). The bot hands each
-- buyer a personal one-use invite link to that chat.
--
-- Changing a format's start date clears its chat (formatAuthoring.ts): a new
-- date is a new stream until the owner picks its chat again.
--
-- ROLLBACK:
--   alter table public.experience_offers drop column if exists stream_chat_id;
--   drop table if exists public.telegram_stream_chats;

create table if not exists public.telegram_stream_chats (
  chat_id bigint primary key,
  title text not null,
  -- Whether the bot, at the last /connect, could create invite links there.
  bot_can_invite boolean not null default false,
  connected_by text null,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.telegram_stream_chats enable row level security;

alter table public.experience_offers
  add column if not exists stream_chat_id bigint null
    references public.telegram_stream_chats(chat_id) on delete set null;
