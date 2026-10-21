-- СТРІЧКА: счётчик «Поділитися» (2026-10-17).
--
-- Зачем. G 17.10: «пошерил — засчитало, но только одно зачисление на один
-- аккаунт». Под дописом рядом со стрелкой стоит число людей, которые им
-- поделились; сколько бы раз человек ни делился, он даёт одну единицу.
--
-- `feed_shares` — одна строка на (допис, аккаунт): первый способ, которым
-- поделились (`link`, `telegram`, `system`), и когда. Гость поделиться может,
-- но в счёт не входит — без аккаунта нельзя сказать, что это тот же человек.
--
-- Таблицу читает и пишет только сервер (service role); RLS включён без
-- политик — клиент её не видит.
--
-- Аддитивно и повторяемо.
--
-- Откат:
--   drop table if exists public.feed_shares;

begin;

create table if not exists public.feed_shares (
  post_id uuid not null references public.feed_posts (id) on delete cascade,
  auth_user_id uuid not null,
  channel text not null,
  created_at timestamptz not null default now(),
  primary key (post_id, auth_user_id),
  constraint feed_shares_channel_known check (channel in ('link', 'telegram', 'system'))
);

alter table public.feed_shares enable row level security;

commit;
