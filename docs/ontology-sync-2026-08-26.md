# Единая онтология: хранилище × репо-доки × код

Дата: 2026-08-26
Статус: сводка + предложение решений; терминологические решения §2 требуют подтверждения владельца,
после чего продвигаются в RAverse-канон (Canon Sync Trigger, AGENTS.md).
Поглощает: черновик `experience-foundation-2026-08-26.md` (удалён), выводы из
`meta-audit-agent-context-v0.2-2026-08-26.md` §1–§6.
Сверено: RAverse `Архитектура.md`, `CenterWay.md`, `Реестр.md`, `Админка.md`;
репо-доки `program-access-model`, `creator-contract`, `platform-scale-plan`, `agent-contour`;
рабочее дерево `a53d9ce5` + 15 миграций.

## 0. Три источника и их слепые зоны — до таблицы

- **Хранилище (RAverse)** — активный авторитет по AGENTS.md, но его операционный срез заморожен на
  **2026-03**: `Архитектура.md` «Текущее состояние (2026-03)» всё ещё говорит «вместо entitlements —
  access_tokens + token_consumed»; `Админка.md` — снимок 2026-03-05 «до этапа LMS/CMS»;
  в `Реестр.md` **нет ни одной строки про LMS** — 15 миграций, lms-core, билдер, офферы и окна доступа
  для канона невидимы. Семантика слоёв A–G актуальна, операционка — нет.
- **Репо-доки** — самые свежие (август), но два поколения словаря: старые говорят языком канона
  (Program/Course), новые (метааудит) — языком Experience/Activity/Provider/Run, и сам документ-источник
  «Agent Context v0.2» не лежит ни в репо, ни в хранилище — есть только аудит на него.
- **Код** — единственный источник, который знает, что реально работает, но он course-центричен и
  дважды называет одно и то же (два источника Offer, три типа локали, `/api/events` — это Meta CAPI,
  а не доменная шина, при том что канон обещает шину событий под тем же словом «события»).

## 1. Единая таблица: понятие × три источника

Легенда: ✓ есть и совпадает · ~ есть частично / расходится · ✗ нет · ⚑ конфликт терминов.

| # | Понятие | Хранилище (канон) | Спеки в репо | Код | Статус |
| --- | --- | --- | --- | --- | --- |
| 1 | Корневая единица «что человек покупает и проходит» | `Program ⊃ Course` (Архитектура, сущности) | метааудит §6.1: `Experience` — контейнер-композиция | корень = `lms_courses`; Program нигде | ⚑ три слова, ни одно не реализовано как корень |
| 2 | Позиция композиции | Lesson/Practice/Assessment — раздельные сущности разных слоёв | `Activity` с `kind = content/practice/assessment/live/human_session` | только контентные блоки; доша-тест изолирован | ⚑ + ✗ |
| 3 | Курс | `Course, Module, Lesson, LessonBlock` | те же слова | `lms_courses/modules/lessons/blocks` + schedule + ревизии | ✓ единственное полностью согласованное ядро |
| 4 | Автор / Провайдер | `AuthorProfile` | метааудит: `Provider` (verify, credentials); creator-contract: «автор» | `lms_authors` (slug, bio, credentials, RLS) + `author_id` (право правки) + `author_profile_id` (byline) | ~ сущность есть с 2026-08-26; нет `verified_at/by`; три термина ⚑ |
| 5 | Оффер | `Product, Offer, Plan` | creator-contract: цена у владельца, отдельная таблица | **два источника**: `PRODUCTS` (products.ts) и `lms_course_offers`; reset-day живёт в обоих под разными `product_code` | ⚑ двойная правда, уже расщепляет заказы |
| 6 | Заказ | `Purchase` | «order» везде | `orders` | ~ работает; термин канона расходится ⚑ |
| 7 | Право доступа | `AccessGrant`; операционно «`entitlements` (план), сейчас access_tokens» | program-access-model: entitlement + окно | `resolveEntitlement` + `lms_enrollments` + `planAccess` | ~ код обогнал канон на 5 месяцев; канон описывает март |
| 8 | Срок/правило доступа | `AccessRule` | program-access-model | `access_days/access_lifetime`, `AccessRule` в access.ts | ✓ совпало вплоть до имени типа |
| 9 | Поток/набор | `Cohort` | метааудит: `Run` (не заводить до второго потока) | нет; `schedule.start='date'` = один поток | ⚑ два слова для несуществующего |
| 10 | Подписка | `Membership, Plan` | scale-plan Phase 3: membership | нет; entitlement без recurring | ✗ осознанно LATER |
| 11 | Ресурс | `Resource` = единица **контента** (слой B) | метааудит: `Resource` = **продаваемое** digital/physical/place | нет ни того ни другого; fulfilment = course/bot/cabinet | ⚑ одно слово, два разных смысла — самая опасная коллизия |
| 12 | Практика (слой D) | `Practice, Ritual, Protocol, CheckIn, Assessment` | — | только доша-тест (`test_*`), вне LMS-модели | ~ Assessment есть изолированно, остальное ✗ |
| 13 | Знания (слой E) | `KnowledgeEntry, GlossaryTerm, DiagnosticRule` | — | ✗ | ✗ согласованно отсутствует |
| 14 | Агенты (слой F) | `AgentTask, WorkflowRun`, модель возможностей | agent-contour, workspace-agent-plan | `jobs/job_runs`, cron, tg-бот — автоматизации без контракта агента | ~ |
| 15 | События | шина доменных событий `lesson.completed, purchase.completed…` + `EventLog` | — | `/api/events` = **Meta CAPI**; доменное — только `lms_progress_events` | ⚑ коллизия имён: «events» в коде ≠ «события» канона |
| 16 | Локаль | канон молчит про UI-локаль | метааудит §6.4: `uk/ru/en` везде | **три диалекта**: `uk/ru/en` (контент), `ru/en` (i18n.ts), `ua/en` (products.ts) | ⚑ |
| 17 | Trust / claims | матрица заявлений (Бренд-контракт) — про маркетинг-копию | метааудит: `claims_kind`, `contraindications` — про поля данных | полей нет; `review_status` + `approved_by` есть | ~ editorial ✓, verification ✗, claims-поля ✗ |
| 18 | Деньги провайдера | нет даже в канонических сущностях | метааудит: ledger — «самое дорогое NOW» | `orders` без provider_id/долей | ✗ слепая зона всех трёх, кроме метааудита |
| 19 | Билдер | не существует для канона (Админка = снимок 2026-03) | builder-доки, creator-contract, метааудит §6.2: internal tooling | `build.` поддомен, drafts, ревью, version history | ~ код+репо согласованы, хранилище слепо |
| 20 | Control Panel L0–L9 | уровни, «paid всегда рождает выдачу» | admin-manual-sales, program-access-model | admin/access, admin/catalog, аудит — фактич. L3+L4 сделаны | ~ канон не знает, что L3/L4 закрыты |

## 2. Решения по терминологии (предложение к подтверждению)

Одно слово на понятие; где живёт правда; что переименовывается только в словаре, не в коде.

| Понятие | Каноничное слово | Что уходит | Примечание |
| --- | --- | --- | --- |
| Корень | **Experience** | «Program» как корень (остаётся только как исторический синоним в канонe) | таблицы `lms_*` НЕ переименовываются; Course = kind внутри Experience |
| Позиция композиции | **Activity** (`kind`) | раздельные сущности как модель верхнего уровня | Lesson/Block остаются внутри kind=course |
| Автор | **Author** (`lms_authors`); «Provider» — синоним в бизнес-текстах | канонное `AuthorProfile` → маппится на `lms_authors` | verified_at/by дописываются, таблица не переименовывается |
| Оффер | **Offer** = строка `lms_course_offers` (далее `experience_offers`) | `PRODUCTS` → seed/legacy, `Plan` — отложенный термин для recurring | |
| Заказ | **Order** (`orders`) | «Purchase» из канона | код прав, канон правится |
| Доступ | **Entitlement** (вычисляемое) + **Enrollment** (`lms_enrollments`, запись) + **AccessRule/Window** | «AccessGrant», «access_tokens как механизм доступа» (токены остаются как хэндофф) | канонное «Текущее состояние» переписывается на август |
| Поток | **Run** (зарезервировано, не создано) | «Cohort» | заводится при втором потоке одного курса |
| Продаваемый ресурс | **Resource** (kind в Activity) | — | контентная единица канона переименовывается в **Asset/MediaAsset**, чтобы снять коллизию №11 |
| Локаль | **Locale = `uk | ru | en`**, один тип из lms-core | `Lang = ru|en`, `Locale = ua|en` | `ua` → `uk` при схлопывании |
| События | **Domain events** (шина, канон) ≠ **tracking events** (`/api/events`, CAPI) | — | в доках всегда уточнять, какие; переименование роутов не требуется |

## 3. Слепые зоны, закрываемые синхронизацией (не кодом)

1. Хранилище: `Реестр.md` — добавить строку(и) LMS/билдер/доступ с source_of_truth
   `src/lms-core/**; supabase/migrations/**` и гейтами `guard:lms-core`, `vitest`.
2. Хранилище: `Архитектура.md` «Текущее состояние» — переписать с марта на август
   (enrollments+окна вместо токенов; L3/L4 закрыты; билдер существует).
3. Хранилище: глоссарий из §2 — новый короткий раздел в `Архитектура.md` или отдельная заметка.
4. Репо: «Agent Context» v0.3 — переписать по рекомендациям метааудита §4 и положить рядом с аудитом
   (сейчас документа-источника нет ни в одном хранилище).
5. Код: колизию №11 и №15 зафиксировать комментарием в местах употребления, чтобы агенты не путались.

## 4. Роадмап

Правило всех фаз: слот = колонка/enum/параметр; реализация — только для продающегося сегодня.
Гейты всех фаз: `npx vitest run` всегда; `npm run ds:qa` при касании поверхностей;
`guard:lms-core` при касании ядра. Ни одна фаза не останавливает платформу.

### Фаза 0 — гигиена истины (без новых сущностей)

- `reset-day` → один `product_code` (сейчас заказы расщепляются на `reset-day` и `course:reset-day` —
  единственное, что портит данные прямо сейчас).
- Синхронизация доков: пункты §3.1–§3.4.
- Решение владельца по §2 — после него термины фиксируются в каноне.

### Фаза 1 — фундамент опыта

- Локаль в один тип (`uk|ru|en`, fallback `uk→ru→en`, `ua`→`uk` в чекауте; тест-гард полноты ключей).
- Миграция `experiences` + `experience_activities` (только `kind='course'`), backfill 1:1.
  Ни один экран в этот день не меняется.
- `resolveEntitlement(experienceId)`; сигнатура на `courseSlug` — обёртка.

### Фаза 2 — один Offer + слоты денег и траста

- `experience_id` в офферах; остаток `PRODUCTS` (short, irem, way21, herbs) → строки таблицы;
  `PRODUCTS` остаётся seed до закрытия QA-окна (`CW_TEST_PRICE_1UAH` — снять до открытия трафика).
- `orders.provider_id / platform_share / provider_share` (nullable) + `lms_authors.verified_at/by`.
- `experiences.claims_kind` + `contraindications`; `experience_offers.recurring_interval` — слоты без UI.

### Фаза 3 — вторая kind

- `kind='assessment'` → доша-тест получает ссылку из композиции (движок готов).
- Окно композиции Experience в админке (метааудит §6.2: следующая единица работы билдер-контура).

### Фаза 4 — LATER (не заводить даже слотом до триггера)

- `Run` — при втором потоке одного курса. Booking/slot/live — при первом продаваемом live.
- `resource.physical` — при первой физической позиции с fulfilment. Membership — по scale-plan Phase 3
  после теста recurring-спроса в Telegram. Слой знаний E, Journey/State/Outcome, payout adapter,
  multi-currency — вне горизонта.
