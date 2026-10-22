-- access_start_and_ref_tags: начало доступа и тег того, кто привёл
-- 22.10.2026
--
-- ЗАЧЕМ.
--   1. Начало доступа. Модалка выдачи даёт самостійному месту период «з … по …».
--      До сих пор у места был только конец (`expires_at`), а «з» писалось в
--      `cohort_starts_on` — это день 1 программы, а не дверь: доступ открывался
--      сразу. Теперь у места есть `access_starts_at`, и дверь (`accessStateOf`)
--      не пускает раньше этого момента. NULL — доступ открыт с момента выдачи,
--      как у всех мест до этой миграции.
--   2. Тег амбасадора. «Хто привів» хранится тегом (`?ref=olena`) в
--      `lms_enrollments.ref` и `orders.ref`, а связи тег ↔ человек не было, так
--      что в админке нельзя было выбрать того, кто привёл, по email. Теперь у
--      аккаунта есть `ref_tag`: выбрали человека — записался его тег, а если
--      тега ещё не было, сервер выдаёт его один раз и навсегда (уникален).
--
--   3. Контакт Telegram. В карточке клиента был только числовой `tg_id`, по
--      которому человека в Telegram не найти. Бот и раньше видел username, но
--      писал его только в сессию поддержки. Теперь у клиента есть
--      `tg_username`; бот пишет его рядом с `tg_id`, а уже известные берутся
--      из `support_bot_sessions`.
--
-- ОТКАТ:
--   alter table public.lms_enrollments drop column if exists access_starts_at;
--   drop index if exists public.platform_users_ref_tag_key;
--   alter table public.platform_users drop constraint if exists platform_users_ref_tag_shape;
--   alter table public.platform_users drop column if exists ref_tag;
--   alter table public.customers drop column if exists tg_username;

begin;

alter table public.lms_enrollments
  add column if not exists access_starts_at timestamptz null;

comment on column public.lms_enrollments.access_starts_at is
  'Когда открывается доступ. NULL — сразу. Дверь не пускает раньше; конец — expires_at.';

alter table public.platform_users
  add column if not exists ref_tag text null;

-- Та же форма, что у lms_enrollments.ref и orders.ref: тег пишут в ссылки руками.
alter table public.platform_users drop constraint if exists platform_users_ref_tag_shape;
alter table public.platform_users
  add constraint platform_users_ref_tag_shape
  check (ref_tag is null or ref_tag ~ '^[a-z0-9][a-z0-9_-]{0,63}$');

create unique index if not exists platform_users_ref_tag_key
  on public.platform_users (ref_tag)
  where ref_tag is not null;

comment on column public.platform_users.ref_tag is
  'Тег амбасадора для ?ref=. Выдаётся при первом выборе человека в «Хто привів», не меняется.';

alter table public.customers
  add column if not exists tg_username text null;

comment on column public.customers.tg_username is
  'Telegram username без @, как его видел бот. Для ссылки t.me/<username> в карточке.';

update public.customers c
set tg_username = nullif(trim(leading '@' from s.telegram_username), '')
from public.support_bot_sessions s
where c.tg_id = s.telegram_user_id
  and c.tg_username is null
  and s.telegram_username is not null;

commit;
