-- product_offers: цена продукта, который не является курсом
-- 03.09.2026
--
-- ЗАЧЕМ. 02.09 цена курсов переехала в `lms_course_offers`, и обе двери каждого
-- продукта (лендинг и витрина) стали читать строку через `loadPayableOffer`.
-- Но эта таблица уникальна по `course_id` — один курс, одна строка, — и два
-- продукта в неё структурно не помещаются:
--
--   way21-support  — второй оффер на тот же курс way21 (9000 ₴), продаётся
--                    через лид-форму лендинга, а не через чекаут;
--   herbs          — вообще не курс (`fulfilment: cabinet`), и цены у него
--                    никогда не было: сейчас стоит QA-шная 1 ₴.
--
-- Плюс продукты-заявки (`LEAD_PRODUCT_CODES`), у которых цена — это котировка,
-- называемая в разговоре, а не сумма для WayForPay. Их вообще нигде нельзя
-- было выставить: `consult` и `irem-individual` не имеют записи в `PRODUCTS`.
--
-- Так что цена этих продуктов жила либо в константе, либо нигде, и владелец не
-- мог её изменить, не позвав разработчика. Эта таблица — их адрес.
--
-- ПОЧЕМУ ОТДЕЛЬНАЯ ТАБЛИЦА, А НЕ КОЛОНКИ В lms_course_offers. Та таблица
-- отвечает на вопрос «сколько стоит ЭТОТ КУРС» и держит `course_id` not null с
-- уникальностью по нему. Здесь предмет другой: код продукта, за которым может
-- не стоять ни одного курса (herbs) или стоять курс, уже проданный под другим
-- кодом (way21-support). Расширять первую таблицу значило бы снять с неё
-- ровно тот инвариант, ради которого она заведена.
--
-- `amount` NULLABLE, и это содержательно. NULL — «ціна за запитом»: у заявки
-- может не быть согласованной суммы, и поверхность обязана сказать это, а не
-- придумать число. Ноль здесь не то же самое: `loadCourseOfferFor` уже
-- трактует `amount <= 0` как «не продаётся».
--
-- `kind` разделяет два разных предмета:
--   'checkout' — сумма, которую попросят у WayForPay;
--   'lead'     — котировка, которую страница показывает, а продажа идёт через
--                лид-форму и счёт после разговора.
-- Без этого различия оператор, поставив цену заявке, открыл бы ей чекаут.
--
-- ПРАВА как у lms_course_offers: одна admin-политика. Цена — предмет
-- владельца; support читает её через сервисный ключ в /api/admin/*, но не
-- пишет (см. `product_offers_admin_all`).
--
-- ЧЕГО ЗДЕСЬ НАМЕРЕННО НЕТ:
--   natural-body — у него уже есть строка в `lms_course_offers` (2900/4100);
--                  вторая запись здесь вернула бы два источника цены, ровно ту
--                  болезнь, которую 02.09 лечили;
--   platform     — это код входящего запроса с платформы, а не продукт;
--   short/irem/way21/reset-day — курсы, их цена в `lms_course_offers`.
--
-- ОТКАТ: drop table public.product_offers;
--        (вместе с откатом чтения в src/lib/platform/productOffers.ts)

begin;

create table if not exists public.product_offers (
  code                text primary key,
  amount              integer,
  list_amount         integer,
  currency            text        not null default 'UAH',
  kind                text        not null default 'checkout',
  pixel_content_name  text,
  active              boolean     not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint product_offers_kind_known
    check (kind in ('checkout', 'lead')),
  -- NULL значит «за запитом»; 0 и отрицательное не значат ничего.
  constraint product_offers_amount_positive
    check (amount is null or amount > 0),
  -- Прейскурантная цена печатается зачёркнутой, поэтому обязана быть выше.
  constraint product_offers_list_above_amount
    check (list_amount is null or (amount is not null and list_amount > amount))
);

comment on table public.product_offers is
  'Цена продукта, за которым не стоит собственный курс: пакеты супровода и заявки. Курсы — в lms_course_offers.';
comment on column public.product_offers.amount is
  'NULL = «ціна за запитом». Поверхность обязана сказать это, а не подставить число.';
comment on column public.product_offers.kind is
  'checkout — сумма для WayForPay; lead — котировка, продажа через лид-форму.';

alter table public.product_offers enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
     where tablename = 'product_offers' and policyname = 'product_offers_admin_all'
  ) then
    execute $p$
      create policy "product_offers_admin_all" on public.product_offers
        for all using (public.get_my_role() = 'admin')
        with check (public.get_my_role() = 'admin')
    $p$;
  end if;
end $$;

create or replace function public.product_offers_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists product_offers_touch on public.product_offers;
create trigger product_offers_touch
  before update on public.product_offers
  for each row execute function public.product_offers_touch_updated_at();

-- СИД — перенос текущего поведения, не новое ценообразование.
-- way21-support и herbs получают то, что сейчас лежит в константах, чтобы
-- ничего не изменилось в день применения. consult и irem-individual заводятся
-- без суммы: у них её и не было, и NULL это честно говорит.
insert into public.product_offers (code, amount, list_amount, currency, kind, pixel_content_name)
values
  ('way21-support',   9000, null, 'UAH', 'lead',     'Way21 Support'),
  ('herbs',              1, null, 'UAH', 'checkout', 'Herbal Blend'),
  ('consult',         null, null, 'UAH', 'lead',     'Consultation'),
  ('irem-individual', null, null, 'UAH', 'lead',     'IREM Individual')
on conflict (code) do nothing;

commit;

-- ПРОВЕРКА:
-- select code, amount, list_amount, kind, active from product_offers order by code;
