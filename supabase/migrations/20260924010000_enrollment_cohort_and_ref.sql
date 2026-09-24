-- lms_enrollments: якорь потока и метка «кто привёл»
-- 19.09.2026
--
-- ЗАЧЕМ. День N считался только от `started_at` — момента, когда ученик впервые
-- открыл курс. Для самостоятельного прохождения это верно (купил в пятницу,
-- начал в воскресенье — два дня протокола не сгорели). Для ПОТОКА это неверно:
-- у марафона «Шлях 21» день 1 общий, и тот, кто записался за неделю, и тот, кто
-- пришёл на третий день, должны видеть один и тот же день.
--
-- ПОЧЕМУ НА ЗАПИСИ, А НЕ НА ОФФЕРЕ. У бесплатного входа нет заказа, а ручная
-- выдача друзьям идёт вообще без оффера — до оффера дата потока просто не
-- дошла бы. Запись ученика есть у всех троих. По той же причине здесь же живёт
-- `ref`: реферальная метка бесплатного участника не может лежать в `orders`.
--
-- `cohort_starts_on` — КАЛЕНДАРНАЯ ДАТА, не момент. «Потік стартує 6 жовтня»
-- значит 6 октября у каждого в его часовом поясе; день 1 в Ванкувере наступает
-- на десять часов позже, чем в Киеве, и это правильно (lms-research §3A.4).
-- NULL — самостоятельный ритм, как было.
--
-- `started_at` НЕ трогаем и не переиспользуем: это факт «когда открыл», он
-- нужен напоминаниям «не начал» и аудитории автора.
--
-- ОТКАТ: alter table public.lms_enrollments
--          drop column cohort_starts_on, drop column ref, drop column utm;

begin;

alter table public.lms_enrollments
  add column if not exists cohort_starts_on date null,
  add column if not exists ref text null,
  add column if not exists utm jsonb null;

comment on column public.lms_enrollments.cohort_starts_on is
  'Общий день 1 потока, календарная дата в поясе ученика. NULL — день 1 это день первого открытия (started_at).';
comment on column public.lms_enrollments.ref is
  'Кто привёл: метка из ?ref. Живёт здесь, потому что у бесплатной записи нет заказа.';
comment on column public.lms_enrollments.utm is
  'UTM-набор момента записи: {source, medium, campaign, content, term}.';

alter table public.lms_enrollments
  drop constraint if exists lms_enrollments_ref_shape;
alter table public.lms_enrollments
  add constraint lms_enrollments_ref_shape
  check (ref is null or ref ~ '^[a-z0-9][a-z0-9_-]{0,63}$');

-- Состав потока и счётчик амбассадора читают именно так.
create index if not exists idx_lms_enrollments_cohort
  on public.lms_enrollments (course_id, cohort_starts_on) where cohort_starts_on is not null;
create index if not exists idx_lms_enrollments_ref
  on public.lms_enrollments (ref) where ref is not null;

-- Та же метка на заказе: платный участник по ссылке амбассадора.
alter table public.orders
  add column if not exists ref text null;
alter table public.orders
  drop constraint if exists orders_ref_shape;
alter table public.orders
  add constraint orders_ref_shape
  check (ref is null or ref ~ '^[a-z0-9][a-z0-9_-]{0,63}$');
create index if not exists idx_orders_ref on public.orders (ref) where ref is not null;

comment on column public.orders.ref is
  'Кто привёл покупателя: метка из ?ref. Отдельно от campaign — это человек, а не рекламная кампания.';

commit;

-- ПРОВЕРКА:
-- select cohort_starts_on, count(*) from lms_enrollments group by 1;
