# Experiences: одна система для всего, что платформа продаёт, даёт и делает

Дата: 2026-09-17, версия 2 от 2026-09-19 (после совета пяти).
Статус: принято, в работе в ветке `feat/experiences-foundation`. Заменяет §6.1 и
§6.3 в `docs/meta-audit-agent-context-v0.2-2026-08-26.md` и часть III роадмепа
`docs/centerway-deconstruction-roadmap-2026-09-01.md`. Инвентарь снят с
`origin/main@5814553b`. Живой чеклист: https://claude.ai/artifact/Tq3tqJP9k58MCE2RJv86Jf

## 0. Решение

Слой `experiences` вводится как **узкий реестр**: всё, что человек может купить,
получить бесплатно или заказать у человека, — строка одной таблицы с одним
автором и одним публичным адресом; цены — в одной таблице офферов; любое старое
имя находит свою вещь или свой оффер. Движок контента (`lms_courses`, уроки,
прогресс) и права доступа (`lms_enrollments`) **не перекладываются**.

Версия 1 этого документа переносила на реестр карточку курса и права доступа.
Совет 19.09 (пять независимых разборов) оставил цель и вырезал около 60 % объёма;
отличия — в §3.

Платёжный шлюз — сменная граница: у WayForPay транзакционного сплита нет,
направление — гибрид (сплит для оформившихся у шлюза авторов, ведомость для
остальных). См. `docs/payments/wfp-split-payments-research-2026-09-17.md` §10.

## 1. Почему (что показал инвентарь)

Полный инвентарь — приложение A. Коротко: пять хранилищ «вещи» (`PRODUCTS`,
`lms_course_offers`, `product_offers`, `lms_courses`, реестр воронок) плюс список в
боте; три хранилища цены и четвёртое в HTML лендингов; двадцать вещей вне
таблиц (`herbs` без строки и автора, `way21-support`, не помещающийся в
`lms_course_offers` из-за UNIQUE по курсу, `irem-individual`, которого нет даже в
`PRODUCTS`, консультация без записи о покупке); у каждого продукта от пяти до
двенадцати имён. Каждый новый вид сейчас добавляет шестое хранилище.

Оговорка совета, которую стоит помнить: **курс внешнего автора уже сегодня
работает без правок кода** (`author_profile_id`, билдер, `course:<slug>`,
динамическая витрина). Правки стоят только консультация, тест или пакет внешнего
автора. Слой нужен ради них и ради нескольких офферов на вещь, а не ради курсов.

## 2. Схема

### 2.1 `experiences` — узкий реестр  ✅ `20260924000000`

`id, kind, slug UNIQUE, author_profile_id, listed, sort_order` и, **только у вещей
без курса**, `title, summary, cover` (CHECK держит это в базе). Виды:
`course · mini · checklist · consultation · package · assessment · physical`.

Для видов с контентом строка — **проекция `lms_courses`, которую ведёт триггер**:
slug = `program_slug`, kind = kind курса, автор = `author_profile_id`, listed =
(published AND listed) хотя бы у одной локали. Второго писателя в коде нет.
`program_slug` не уникален (uk/en делят адрес), поэтому связь курс → вещь
многие-к-одному. Ссылка всегда от исполнителя к вещи: `lms_courses.experience_id`
(NOT NULL), `test_definitions.experience_id`.

Карточка курса — заголовок, обложка, статус, видимость, review — остаётся на
`lms_courses` под ревизиями и `publishedEditPolicy`.

### 2.2 Имена — два пространства

`experience_aliases (alias → experience_id, kind slug|host)` ✅ — старые адреса и
хосты воронок; при смене `program_slug` старый адрес сам становится алиасом.
`offer_aliases (code → offer_id)` — коды чекаута и старых заказов; появляется
вместе с офферами. Раздельно, потому что при нескольких офферах на вещь код,
указывающий на вещь, неоднозначен.

### 2.3 `experience_offers` + `experience_offer_items`  ✅ `20260924020000`

Слияние трёх хранилищ цены. `experience_id` (без UNIQUE — несколько офферов на
вещь), `code UNIQUE`, `mode checkout|lead|free`, `amount NULL = за запитом`,
`list_amount`, срок доступа, `invoice_heading/description {uk,en}` (сегодня берутся
из `PRODUCTS`, `offers.ts:445`), `share_pct NULL = ставка автора`,
`pixel_content_name`, `active`. `offer_items` заполняется сразу строкой
«`way21-support` открывает way21»: сегодня эту связь держит массив кодов на
курсе, и без строки покупатель пакета потерял бы курс.

### 2.4 Права и исполнение — разные сущности

`lms_enrollments` остаётся правом на контент с ключом по курсу. Добавлены ✅
`20260924010000`: `cohort_starts_on date` (общий день 1 потока, календарная дата в
поясе ученика), `ref`, `utm`. Якорь и метка живут на записи, а не на оффере или
заказе: у бесплатного входа нет заказа, у ручной выдачи нет оффера.

Услуга и посылка потребляются, поэтому состояние исполнения — на заказе:
`orders.fulfilment_status pending|scheduled|done|cancelled`. Вторая консультация —
второй заказ, без конфликта уникальности.

### 2.5 Деньги

`orders`: `ref` ✅ (`20260924010000`); `experience_id` и `offer_id` — вместе с офферами.
Доли — строками:
`order_shares (order_ref, recipient_kind platform|author|ambassador, recipient_id,
amount, settled_via split|payout|credit, settled_at)`. На авторе —
`payout_provider, payout_account_ref, payout_verified_at, default_share_pct`.
Шлюз — за границей из четырёх операций: `createInvoice / verifyCallback / refund /
reconcile`; сегодня про WFP напрямую знают 16 файлов в `src`.

### 2.6 Что удаляется — последним шагом

`PRODUCTS`, `normalizeProduct`, `LEAD_PRODUCT_CODES`, `PAYABLE_BY_SLUG`,
`COURSE_CODE_ALIASES`, `PRICEABLE_PRODUCTS`, `PRODUCT_LABELS` в боте,
`fulfilment.kind = bot`, ключ `detox`, `product_offers`, `lms_course_offers`,
`entitlement_product_codes`. До последнего шага остаются обёртками: это
единственный платёжный путь.

## 3. Что изменилось с версии 1

| Было | Стало | Почему |
| --- | --- | --- |
| Карточка курса переезжает на реестр | Остаётся на `lms_courses` | Заголовок ушёл бы из-под ревизий; «один статус вместо трёх» = три поля плюс синхронизация |
| `entitlements` с ключом по вещи и статусом исполнения | Права не трогаем; статус на заказе | Право длится, услуга потребляется; `UNIQUE(вещь, человек)` не выдерживает вторую консультацию |
| `starts_at` на оффере, `ref` в заказе | Оба на enrollment (`ref` и в заказе) | У бесплатного марафона нет заказа, у ручной выдачи нет оффера |
| Один алиас → вещь | Имя → вещь, код → оффер | Несколько офферов на вещь |
| Две колонки долей | Строки `order_shares` | Набор двух авторов и амбассадор |
| WFP как данность | Граница шлюза, гибрид | У WFP нет сплита |
| Удаление `PRODUCTS` шагом 2 | Последним | Единственный платёжный путь |
| `live`, `recurring_interval`, тесты-черновики, `BRAND.founder`/JSON-LD в базу | Вырезано | Слоты под то, чего никто не купил; основатель бренда ≠ автор курса. Реальных мест «автор = основатель» три |
| Поток и реферал шестым шагом | Первым | Ни от чего не зависят |

## 4. Порядок

0. Решения владельца: второй шлюз; условия автора на одной странице; заявка `won`
   создаёт заказ сама или руками.
1. **Поток и ссылка** — на текущей схеме. ✅ якорь потока, `dripAnchor`, `?ref` и
   UTM через cookie до enrollment и заказа, дата и метка в ручной выдаче, поток и
   «привів» на каждой записи в админке, `orders.fulfilment_status` с автоматическим
   `pending` и выпадающим статусом в списке заказов. Ждёт решения: счётчик
   амбассадора в кабинете (кто выдаёт метку); статус в панели заявок (заявка `won`
   создаёт заказ сама или руками).
2. **Реестр и имена.** ✅ целиком.
3. **Один оффер.** ✅ `20260924020000` и `20260924030000`: одна таблица цен, наборы,
   старые коды, заказ узнаёт вещь и оффер; цена и срок доступа читаются из новой
   таблицы; курс открывается заказом, чей оффер его содержит (`course_opening_codes`).
   Осталось, в финальном денежном шаге: код оффера через `offer_aliases` вместо
   `normalizeProduct`; каталог пишет в новую таблицу (и зеркало удаляется); несколько
   офферов на странице вещи (нужно решение по уровням).
4. **Шлюз как граница и доли.** Второй шлюз ждёт решения из шага 0.
5. **Автор там, где он зашит.** ✅ основатель больше не исключение (мёртвый
   `isFounderAuthorSlug` удалён), запасная карточка совпадает с базой, авторы в
   sitemap и llms.txt. Выход из теста доши и скоуп ручной продажи оставлены как есть:
   для одного автора они верны.
6. **Уборка.** ✅ частично: старые адреса программ — строки `experience_aliases`,
   четыре страницы-редиректа удалены. Остальное — после того, как каталог пишет в
   новую таблицу.

---

## Приложение A. Инвентарь (origin/main@5814553b)

### A.0 Пять хранилищ «вещи»

| Хранилище | Где | Ключ | Кто пишет |
| --- | --- | --- | --- |
| `PRODUCTS` | `src/lib/products.ts:72-194` | `CatalogProductCode` (6 ключей) | разработчик + деплой |
| `lms_course_offers` | `20260822000000_lms_course_storefront.sql`, `20260826030000_program_access_windows.sql`, `20260902000000_free_course_offers.sql` | `code = course:<slug>` UNIQUE; `course_id` UNIQUE с `20260828010000` | admin |
| `product_offers` | `20260903000000_product_offers.sql` | `code` PK | admin |
| `lms_courses` | `20260815000000_lms_foundation.sql` + ~20 ALTER | `slug`, `program_slug`, `entitlement_product_codes[]` | автор (RLS) / admin |
| `PRODUCT_SURFACE_REGISTRY` | `src/lib/surfaces/catalog.ts:254-355` | `ProductKey` (8 ключей) | разработчик |

Порядок резолва цены: `loadPayableOffer`, `src/lib/platform/offers.ts:434-452`.

### A.1 Продаётся или предлагается

`PRODUCTS` (`src/lib/products.ts`):

| code | строки | реальная цена | fulfilment | pixel | где продаётся |
| --- | --- | --- | --- | --- | --- |
| `short` | 74-93 | `lms_course_offers` через алиас (795) | course → short / reboot | Short Reboot | `/programs/reboot`, `/reboot`, `/reboot-b` |
| `irem` | 95-116 | через алиас `irem-gymnastics` (3950) | course | IREM | `/programs/irem`, `/irem` |
| `way21` | 118-133 | через алиас (4100) | course | Way21 Detox | `/programs/way21`, `/way21` |
| `way21-support` | 135-153 | `product_offers` lead 9000 | course way21 | Way21 Support | только форма на `/way21` |
| `reset-day` | 155-170 | через алиас (690/795) | course | Reset Day | `/programs/reset-day`, `/reset-day` |
| `herbs` | 172-193 | `product_offers` amount NULL | **cabinet** | Herbal Blend | `/products/herbs`, `/herbs` |

Алиасы `normalizeProduct` (`products.ts:246-281`): reboot→short; irem-individual|irem_individual|irem-support; way21_support; shlyah21|detox21→way21; reset_day|reset|rozvantazhennya→reset-day; consultation→consult; ideal-body|ideal_body|idealne-tilo→natural-body; centerway→platform.

`fulfilment.kind` (`products.ts:297-323`): `course`, `bot` (никем не объявлен, ветка живая в `fulfilmentDestination.ts:28`), `cabinet` (только herbs). `orderFulfilment` (`fulfilmentDestination.ts:53-61`): неизвестное → cabinet.

`lms_course_offers` (seed `supabase/local/020_content.sql`): `course:way21` 4100 lifetime; `course:natural-body` 2900/4100 90 дней; `course:soul-daily-ritual` 0; `course:short` 795; `course:irem-gymnastics` 3950; `course:reset-day` 690/795. Колонки: `id, course_id, code, amount, list_amount, currency, pixel_content_name, active, access_days, access_lifetime, timestamps`.

`product_offers` (`PRICEABLE_PRODUCTS`, `src/lib/admin/productOffers.ts:33-38`): `way21-support` 9000 lead; `herbs` checkout NULL; `consult` NULL lead; `irem-individual` NULL lead. Колонки: `code PK, amount NULL=«за запитом», list_amount, currency, kind checkout|lead, pixel_content_name, active`.

Коды чекаута: `course:<slug>` только в `src/lms-core/offerCode.ts:20-39`; `entitlement_product_codes` live: `{short,reboot}`, `{irem-gymnastics,ivem-gimnastika,irem}`, `{way21,way21-support,detox21,shlyah21}`, `{reset-day,mini-detox}`, `{natural-body,ideal-body}`, `{}` у курсов билдера (`access.ts:104-112`); `COURSE_CODE_ALIASES` `offers.ts:381-386`.

Lead-коды: `LEAD_PRODUCT_CODES = [consult, natural-body, platform, irem-individual]` (`products.ts:199`); `LEAD_BY_SLUG` (`offerCommerce.ts:95-99`) natural-body, consult, herbs; фолбэк `platform` (`:184, :203`). Резолверы `offerCommerce.ts`: `courseOfferCommerce :121-161`, `resolveOfferCommerce :163-185` (`PAYABLE_BY_SLUG` reboot:short, reset-day, way21, irem, herbs), `productOfferCommerce :201-218`; режимы checkout|free|lead.

### A.2 Бесплатное и входы

- Тест доши: `test_definitions` slug `dosha-test` v2; миграции `20260401000000`, `20260403000000`, `20260914000000`; таблицы `test_definitions/questions/options/attempts/answers`, view `v_user_latest_test_attempts`, `v_user_dosha_test_profile`; код `src/lib/dosha/*`, `src/components/dosha-test/*`, `src/app/api/tests/[testSlug]/*`, `api/test-attempts/[attemptId]/*`; поверхности `/tests`, `/tests/dosha`, `/dosha-test` (308), `dosha.centerway.net.ua`, `DoshaWheel`/`DoshaMark`. Без оффера; выходы `DOSHA_PRIMARY_EXIT → /consult`, `SECONDARY → /way21` (`doshaRouting.ts:17-33`).
- Бесплатные курсы: `amount = 0` (`20260902000000`), источник `free` (`access.ts:17,119-121`); один: `soul-daily-ritual`.
- Журнал: `/journal`, `src/lib/lms/journal.ts`, `src/lms-core/journal.ts`, `JournalClient.tsx`, `api/lms/me/journal`; данные `lms_annotations` + `lms_progress_events`.
- Ручные выдачи: `lms_enrollments.source ∈ {order, token, manual, bonus, promotion, free}`; `GRANT_SOURCES` (`accessTypes.ts:22`); `provisionAccess`/`recordManualPayment` (`access/payments.ts:31,174-273`), `manual_` order_ref.
- `access_tokens`: с 29.08 не решает доступ (`access.ts:27-51`), только ссылка для Telegram.
- `personal_offer_tokens` (`20260518000000`, `20260522000000`): только IREM early-bird 2900/4100 48ч; `src/lib/landing/offers.ts:91-95, 311-456`; `/go/irem`, `/api/admin/landing-offers`.

### A.3 Человеческие услуги

- Консультация: `src/app/(platform)/consult/page.tsx`, `content.ts:351-359`, `consultPageContract.ts`, `ConsultPageSections.tsx`; лендинг `landing-static/consult`, реестр `catalog.ts:344-354` ctaMode lead; `product_offers.consult` NULL; исполнение: `leads` → Telegram (`api/leads/route.ts:19-51`). Нет записи о покупке.
- Консультация автора: `lms_authors.consultation_enabled/title/summary/points/contact_url` (`20260831000000`); `AuthorSectionConsultation.tsx`, `ConsultantDirectory.tsx`; у основателя контакт `t.me/E_Koriakin` (личный, не бот).
- `way21-support`: только `data-lead-product` на `/way21`.
- `irem-individual`: нет в `PRODUCTS`; алиас + lead-код + строка + атрибут на `/irem`.
- `natural-body` как lead при живом оффере 2900.
- Бот поддержки `@centerway_support_bot`: `src/lib/telegram/tgSupportBot.ts`, `api/tg/support-bot`, `support_bot_sessions` (`20260424000000`, `20260821020000`); ничего не выдаёт, проверяет оплату (`findPaidOrder :324-351`); `PRODUCT_LABELS :103-108` пятый список; `PRODUCT_DELIVERY :129-134` падает при загрузке модуля, если fulfilment не course.
- Выдают что-то: `/go/irem`, `api/test-attempts/[attemptId]/telegram` (`doshaTelegramLink.ts`), напоминания `lms/notify.ts`, `lms/reminders.ts`, `lms_reminder_log`, `lms_unstarted_reminders`.

### A.4 Лендинги `src/landing-static/*`

| dir | хост | роут | продаёт | через |
| --- | --- | --- | --- | --- |
| short | reboot.centerway | `(funnels)/short`, `(funnels)/reboot`, `landing/config.ts` | Short | `data-cw-price="short"`, checkout.js |
| short-b | нет (A/B) | `reboot-b/route.ts` | Short | `data-cw-product="short"` |
| irem | irem.centerway | `(funnels)/irem` | IREM 3950 + `irem-individual` lead | `offer_token` |
| way21 | way21.centerway | `way21/route.ts` | way21 + way21-support + цена reset-day | |
| reset-day | resetday.centerway | `reset-day/route.ts` | Reset Day | |
| herbs | herbs.centerway | `herbs/route.ts` | травы, гейт по цене (`landingPrices.ts:83-102`) | lead или checkout |
| consult | consult.centerway | `staticLandingRoute.ts` | консультация | `/api/leads` |
| dosha | dosha.centerway | то же | ничего → `/tests/dosha` | redirect |

У каждого `thanks.html`, `pay-failed.html`, `public-offer.html` (WFP хранит return URL, `products.ts:19-21`); `index2.html` — живые страницы политики конфиденциальности и возврата, на них ссылаются лендинги (в первой версии инвентаря ошибочно названы неиспользуемыми). Инъекция цен: `priceSync.ts`, `landingPrices.ts`, `prepareLandingHtml.ts`; shared JS `checkout, lead-form, landing-pixel, funnel-network, proof`.

### A.5 Что у человека есть

| Таблица | Миграция | Хранит | Проверка |
| --- | --- | --- | --- |
| `orders` | baseline `local/010_schema.sql:92` | order_ref, product_code, amount, status, customer_id, meta, payload, fbp/fbc/fbclid, campaign, ip/ua, page_url | через `customers.auth_user_id` |
| `payments` | :199 | provider wfp, order_ref, tx id, status, raw | admin |
| `customers` | :844 | email, phone, auth_user_id, tg_id, tags, notes | `linkPurchases.ts` по verified email |
| `lms_enrollments` | foundation + `20260826030000` | course_id, auth_user_id, source, order_ref, started_at, expires_at, status active|revoked, revoked_at, blocked_at/reason, granted_by; UNIQUE(course,user) | RLS + `ensureEnrollment` (`server.ts:331`) |
| `lms_progress_events` | foundation, `20260817000000`, `20260911000000` | lesson.started|opened|completed|uncompleted, checklist.toggled; UNIQUE(enrollment, client_id) | |
| `lms_annotations` | `20260828000000` | bookmark|highlight, anchor, note, course_version | |
| `leads` | `20260217000000`, RLS `20260620000000`, `20260910000000` | product_code, source, контакты, payload, tracking, stage new|in_progress|won|lost | admin |
| `test_attempts/answers` | dosha | scores, result_type, payload | user_id или session_id |
| `access_tokens` | baseline | ссылка Telegram | не доступ |
| `personal_offer_tokens` | `20260518000000` | цена IREM для получателя | токен в URL |
| `lms_reminder_log`, `lms_unstarted_reminders` | | что уже напомнили | |
| `user_roles` | `20260821000000` | user|coach|support|admin | `get_my_role()` |
| `platform_users` | `20260401010000` | timezone, locale, каналы | self |
| `agent_runs/messages/questions`, `audit_log`, `events`, `jobs` | | | admin |

Правило: `resolveEntitlement` `access.ts:103-134`: manual → free → earliest paid; окна `planAccess :293-356`; `accessStateOf :217-221` (blocked > revoked > expired > active).

### A.6 Авторы

- `lms_authors` (`20260826000000`, `20260829205051`, `20260831000000`): auth_user_id NULL UNIQUE, slug, name, role, bio, quote, credentials, photo, background, profile_facts, profile_blocks, badges, consultation_*, listed.
- На `lms_courses` два поля: `author_id → auth.users` (право редактировать, `20260820000000`) и `author_profile_id → lms_authors` (чьё имя).
- Роли `user|coach|support|admin`; `coach` никем не читается (`GRANTABLE_ROLES` `accessTypes.ts:94`). Приложения `apps.ts:27-80`.
- Показ автора: `/experts`, `/expert/[slug]`, `AuthorCard`, `AuthorEntry`, `AuthorProfileShowcase`, `ConsultantDirectory`, `cabinet/AuthorSection*`, `blocks/trust/guides.tsx`.
- «Автор = основатель» в коде: (1) `lms/authorRoutes.ts:31` `FOUNDER_SLUGS`; (2) `brand/identity.ts:115-124` `BRAND.founder` path `/consult`; (3) `seo/jsonLd.ts:30,56,85-88` Person + Organization.founder; (4) `(platform)/layout.tsx:38-39` authors/creator; (5) `llms.txt/route.ts:102` «## Автор»; (6) `content.ts:319-334` `platformGuides` (и :288-305 признание, что должно стать `lms_authors`); (7) `content.ts:67-82` `socialLinks`/`contact` личные; (8) `doshaRouting.ts:6-16` выход только к основателю; (9) миграции `20260829000000`, `20260829010000` по slug; (10) `access/payments.ts:66` скоуп `all_open`.

### A.7 Админ-поверхности

Nav `AdminShell.tsx:105-111`: analytics, orders, customers, jobs, access, catalog, system. Гейт `AdminGate.tsx`, `requireAdmin.ts`, `data/admin-authz-matrix.json`.

| Поверхность | Сервис | API | Пишет |
| --- | --- | --- | --- |
| Каталог (курс) | `admin/catalog.ts` (`listCatalog:108`, `saveOffer:293`, `setOfferActive:390`) | `api/admin/catalog` | `lms_course_offers`, `lms_courses.access_note` |
| Каталог (продукты) `ProductPricingTab` | `admin/productOffers.ts` | `api/admin/catalog/products` | `product_offers` |
| Доступ | `admin/access.ts` + `access/{accounts,courses,enrollments,payments,roles}` | `api/admin/access/*` | enrollments, user_roles, модерация, `author_profile_id` (`CourseAuthorshipTab`) |
| Ручная продажа | `access/payments.ts` | | orders `manual_`, payments, customers, enrollments, leads.stage |
| Заказы | `admin/customers.ts` | `api/admin/orders`, `/access-link`, `/purchases/backfill` | orders.status, resend link |
| Заявки `LeadsPanel` | `platform/leadStage.ts` | `api/admin/leads` | leads.stage |
| Персональные офферы | `landing/offers.ts` | `api/admin/landing-offers` | personal_offer_tokens |
| Аналитика | `analytics/*`, `tracking/metaAdsSync.ts` | `api/admin/analytics{,/dosha,/marketing,/sync-meta}` | analytics_* |
| Jobs/System/Audit | `admin/jobs.ts`, `agent/runs.ts` | | jobs, audit_log |

Билдер: `(builder)/build/**`, `lms/{builder,authoring,revisions,release,publishedEditPolicy}.ts`, `api/lms/authoring/**`. Рассылок в `main` нет (только `docs/author-learner-contact-2026-09-09.md`).

### A.8 Сквозное

- Пиксель: три хранилища имени + литералы `data-cw-content-name` в HTML; читается `paymentStart.ts:320`, `jobs/worker.ts:42`, `tracking/capi.ts:91`; нормализация `analytics/pixelEvents.ts:13`.
- Отчётная идентичность: `analytics/productIdentity.ts` схлопывает `short` и `course:short`.
- UTM: `orders.campaign` + tracking-поля пишет `paymentStart.ts:255-263`; `leads` то же (`checkoutFlow.ts:20-31`); выходы доши ставят `utm_source=platform&utm_medium=dosha_test…` (`doshaRouting.ts:52-73`).
- Sitemap `app/sitemap.ts`: 16 рукописных роутов (`catalog.ts:414-442`) + listed-курсы; нет `/experts`, `/expert/*`, воронок.
- llms.txt: `programs` (только herbs) + курсы; рукописный блок «З чого почати».
- PWA: `app/manifest.ts`, `public/sw.js`, `pwa/*`, `PwaInstallCard`.
- Кабинет на my.: `catalog.ts:26-234`, `proxy.ts`, `proxy/personal.ts`; полка `cabinet/{LearnShelfClient,ShelfPresentation,ShelfFilter,CourseCard}` ← `api/lms/me/courses` → `listLearnerCourses` (`server.ts:573`); сторож `shelfHealth.ts` + `cron/shelf-check` (`20260902030000`).

### A.9 Вне таблиц

1. `herbs` — нет строки, автора, уроков; текст в `content.ts:135-175`; fulfilment cabinet уникален.
2. `way21-support` — второй оффер на курс, невозможен в `lms_course_offers`.
3. `irem-individual` — нет в `PRODUCTS`.
4. `consult` — строка без цены, без записи о покупке/исполнении.
5. `platform` — lead-код-фолбэк, не продукт.
6. `natural-body` как lead при живом оффере.
7. Тесты `agni`, `overload`, `rhythm` (`platform/tests.ts:45-83`) planned, без `test_definitions`.
8. Ключ `detox` в реестре (`catalog.ts:278-288`) ради 308.
9. `fulfilment.kind = bot` без объявлений.
10. Роль `coach` никем не читается.
11. `short-b` без реестра, хоста, sitemap.
12. `platformGuides` дублирует строку `lms_authors`.
13. `socialLinks`/`contact` — личные контакты основателя как константы бренда.
14. `data-cw-offer-id` в HTML: `short_reboot_359`, `reset_day_795`, `way21_self_4100`, `way21_self_3100`, `herbs_single`, `irem_main_4100`, `irem_launch_early_bird_2900`; в таблице только два последних.
15. `data-cw-price-value` литералы: 359 на short (реально 795), 3950, 3100/4100.
16. `legal.publicOffer`/`privacy` в `content.ts:394-399` + пять копий `public-offer.html`.
17. `journeySteps`, `bodySignals`, `platformEntryCards`, `proofItems`, `naturalSupportItems`, `doshas`, `testsHubCopy` — редакционный контент без хранилища.
18. `data/courses/*.json` — пять фикстур, дублируют базу.
19. `novyi-kurs-3`, `novyi-kurs-4` — черновики билдера без оффера.
20. `platformAggregateArtwork`, `platformPageArtwork` (`content.ts:207-246`).

### A.10 Двойные имена

| Объект | Имена |
| --- | --- |
| Short | slug `short` · адрес `reboot` · ключ `short` · коды `short`, `course:short` · entitlement `{short, reboot}` · хост reboot · папки `short/`, `short-b/` · реестр `reboot` · бот «Шот» · пиксель Short Reboot · `short_reboot_359` |
| IREM | slug `irem-gymnastics` (был `ivem-gimnastika`) · адрес `irem` · коды `irem`, `course:irem-gymnastics` · entitlement три кода · lead `irem-individual` (+2 алиаса) · пиксели IREM / IREM Individual · два offer-id |
| Way 21 | `way21` · алиасы `shlyah21`, `detox21`, `detox` · реестр `way21` + `detox` · коды `way21`, `course:way21`, `way21-support` тоже entitlement · пиксели два · offer-id два |
| Reset Day | `reset-day` · алиасы `resetday`, `rozvantazhennya`, `reset`, `reset_day`, `mini-detox`, `mini_detox` · хост resetday · редиректы `/mini-detox`, `/programs/mini-detox` |
| Natural Body | `natural-body` · был `ideal-body` (+2) · lead-код тоже · пиксель по-украински, в отличие от остальных |
| Soul Daily Ritual | `soul-daily-ritual` (был `novyi-kurs-5`) · entitlement `course:novyi-kurs-5` · редирект `/programs/novyi-kurs-5` |
| Herbs | реестр · `PRODUCTS` · `product_offers` · `content.ts` · `/products/herbs`, `/herbs`, хост · lead и checkout коды |
| Тест доши | реестр `dosha` (+`dosha-test`) · `test_definitions` `dosha-test` · `platformTests` `dosha`/`dosha-test` · `/tests/dosha`, `/dosha-test`, хост |
| Основатель | `yevhenii-koriakin` (БД) vs `evgeniy-koryakin` (`platformGuides`) · `BRAND.founder` · `/consult` вместо `/expert/<slug>` |
| Автор курса | `author_id` vs `author_profile_id` vs `lms_authors.auth_user_id` |
| Срок доступа | offer `access_days/lifetime` vs enrollment `expires_at` vs course `access_note` |
| Публичность | `status` vs `visibility` vs `review_status`/`pending_review_status` |
| Цена | `PRODUCTS.amount/listAmount` vs два стора vs HTML |
| Вид | `course|mini|checklist` vs `program|mini-course|product` |
| CTA | `lead|checkout|redirect` vs `checkout|free|lead` vs `checkout|lead` |
| «Есть у человека» | orders vs enrollments vs customers.tags vs leads.won |
