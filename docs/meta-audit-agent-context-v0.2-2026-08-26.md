# Метааудит «Agent Context v0.2» × текущий код

Дата: 2026-08-26
Статус: аудит, не решение. Сверено с `main` на `ca753661`, 11 миграций `supabase/migrations/`, `src/lms-core/*`, `src/lib/products.ts`, `docs/lms-research-2026-08-15.md`, `docs/creator-contract-2026-08-22.md`, `docs/agent-contour-2026-08-21.md`.

## 0. Вердикт в одну строку

Документ хорош как **направление** и честен в «DO NOT ASSUME», но он описывает платформу, которой в коде нет: код — это LMS с course-центричной схемой, документ — Experience-центричная онтология. Разрыв не в деталях, а в корневой абстракции, и документ этого разрыва не называет. Его надо либо переписать как *migration map* от `Course` к `Experience`, либо честно пометить §4–§5 как «целевая модель, не текущая».

## 1. Что документ утверждает и что есть в коде

| Тезис документа | Код сейчас | Оценка |
| --- | --- | --- |
| Core abstraction = **Experience**, не Course | `lms_courses → lms_modules → lessons → blocks`; `src/lms-core/course.ts`: «Program ⊃ Course ⊃ Module ⊃ Lesson ⊃ Block» | ✗ **корневое расхождение**. Всё ядро, билдер, ридер, entitlement, offers — привязаны к `course` |
| Activity: content / practice / assessment / live / human_session | Есть только `content` (блоки: p/h3/ul/ol + таблица/видео/картинка/кнопка) и отдельный `dosha-test` вне LMS. `live`, `human_session` — нет ни сущности, ни слота | ✗ дошатест — прецедент `assessment`, но он не Activity, а изолированный движок |
| Resource: digital / physical / place | `herbs` — карточка каталога без цены и без модели fulfilment. `products.ts.fulfilment` знает три вида: `course / bot / cabinet` — это delivery, не Resource | ✗ physical/place отсутствуют целиком |
| **Offer** = commercial wrapper | `lms_course_offers` (code, amount, list_amount, currency, pixel_content_name, active) + `PRODUCTS` в `products.ts` | ✓ по смыслу совпадает, но **две источника правды** (таблица vs константа) — документ этого не фиксирует |
| **Run** = time-specific instance | `CourseSchedule { mode: open/sequential/daily, start: purchase/date, startDate }` — расписание живёт *внутри курса*, а не как отдельная сущность | ~ есть «self-paced», нет «September cohort» как записи; cohort в коде упоминается только как `manualGrants` |
| Order / Booking | `orders` (product_code, status, amount, currency) — есть. Booking — нет; `consult` = lead-форма (`/api/leads`), намеренно без календаря (agent-contour §1, A3) | ~ Order ✓, Booking ✗ по решению |
| Entitlement | `src/lms-core/access.ts`: `resolveEntitlement`, источники `order / token / manual`, provider-agnostic — **лучший кусок кода относительно тезиса** | ✓ |
| Participation → State/Outcome | `lms_progress_events` (lesson.started/completed/uncompleted/checklist.toggled) | ✓ как слот; документ правильно отодвигает State/Outcome в LATER |
| **Provider** = profiles + roles | `lms_courses.author_id` + `brand: string`; RLS по строке (creator-contract §1). Профиля провайдера, credentials, tradition, верификации — нет | ✗ есть «автор» как auth.uid, нет «провайдера» как сущности |
| Trust: verification + editorial approval + claims fields | `review_status: draft/in_review/changes_requested/approved` + `approved_by` — есть. Claims-поля (traditional / evidence-informed / medical), contraindications — нет | ~ editorial ✓, verification ✗, claims ✗ |
| Locale UA + RU first-class | Контент: `locale IN ('uk','ru','en')`, `translationGroupId` ✓. **Но** `src/lib/i18n.ts`: `Lang = "ru" \| "en"` — UI-словарь без `uk`; `I18nProvider` default `ru` | ✗ на момент аудита. **Закрыто 2026-08-27 (§6.4): `uk \| en` везде, RU снят как локаль** |
| WayForPay, не Fondy; provider-agnostic | `wfp.ts / paymentStart.ts / pay.ts`, Fondy в коде нет; `EntitlementSource` независим от PSP | ✓ |
| Provider earnings ledger, payout adapter | Ничего. `orders` = платформенная выручка, нет разделения на platform/provider | ✗ отсутствует; для «NOW» это самый дорогой пропуск |
| Provider dashboard не MVP | Но `build.centerway.net.ua` (билдер) **уже существует** и растёт (drafts, zen preview, version history, import/export, review flow) | ✗ **документ противоречит фактическому вектору разработки**: последние ~15 коммитов — билдер и ридер, т.е. creator tooling, которое документ относит в LATER |
| «Не стройте Experience Composer для авторов» | `creator-contract`, `agent-contour` A1 (авторский агент), `builder-wysiwyg-authoring-model` — это ровно Composer для авторов | ✗ см. выше |

## 2. Метауровень: что не так с самим документом

**2.1 Подмена: «Course — плохая абстракция» без плана, как из неё выйти.** В коде `course` — не «один из типов», а несущая конструкция 11 миграций, ~30 docs и всех гейтов (`courseReadiness`, `canEditCourse`, `writeCourseStructure`). Документ говорит «Experience, не Course» так, будто это выбор слова. На деле либо (а) `Experience` = переименованный `course` с расширенным `activity.kind`, либо (б) новая сущность, у которой `course` — один composition-template. Документ должен выбрать; сейчас он не выбирает, и агент, следующий ему, начнёт плодить `experience_*` рядом с `lms_*`.

**2.2 Внутреннее противоречие: managed-marketplace ⇄ builder.** §7 говорит: команда собирает Experiences сама через internal admin tooling. Репо говорит: главный фронт последних двух недель — self-service builder для внешних авторов с review-workflow. Оба варианта легитимны, но документ утверждает один, а код делает другой. Это самое важное расхождение, потому что оно про *куда идут часы*, а не про схему.

**2.3 Stress-test §12 не запущен против кода.** Список из 11 форм («course, consultation, cohort, weekly practice, webinar, assessment+session, program+kit, multi-author, retreat, membership, podcast→paid») — правильный инструмент. Прогон по текущей модели:

| Форма | Покрыта `course`+`offer`+`entitlement`? |
| --- | --- |
| course | ✓ |
| consultation | ✗ lead-форма вне модели, нет Booking/slot |
| cohort program | ~ `schedule.start='date'` — один cohort на course, второй = копия курса |
| weekly practice | ✗ нет recurring Activity, нет `live` |
| webinar | ✗ |
| assessment + session | ✗ дошатест изолирован, session нет |
| program + physical kit | ✗ нет Resource.physical, нет fulfilment для физического |
| multi-author program | ✗ `author_id` — одна uuid на course |
| retreat | ✗ |
| membership | ✗ entitlement без срока/recurring (есть только `expiresAt` у token) |
| podcast → paid program | ~ content-блоками можно, но нет «free tier → paid» в offer |

Итог: **2 из 11**. Документ прав, что это нужно проверять разработкой, но стоило бы честно записать стартовую точку.

**2.4 «Language first-class» заявлено, но не проверено.** Контент-схема uk/ru/en в порядке; UI-i18n без `uk` — прямой конфликт с «UA + RU first-class». Документ ссылается на research 3A.3, но не на `src/lib/i18n.ts`. → Закрыто 2026-08-27: см. §6.4, локалей две (`uk | en`), словарь админки переведён.

**2.5 Два источника правды по Offer.** `PRODUCTS` (константа, старые воронки, тестовая цена 1 ₴ с 2026-08-21 — **актуальна, QA-окно открыто (подтверждено 2026-08-26)**) и `lms_course_offers` (таблица, билдер). `offerCommerce.ts` решает «продавать или форма» по обоим. Документ должен назвать, какой из них становится `Offer`, иначе «Offer» в документе — третий.

**2.6 Provider ≠ author.** Документ вводит Provider с verify/curate/co-design. Код знает только `author_id` (кто может редактировать) и `brand` (строка, изоляция + host). Нет ни таблицы, ни профиля, ни credentials. Для «Trust — часть продукта» это не NEXT, это отсутствующий фундамент.

**2.7 Ledger — самое дорогое «NOW» без единой строки кода.** Пока один провайдер (founder) — не больно. Но документ сам говорит «3–5 guest experts» как следующий шаг; первый внешний автор с продажами → нужно знать, сколько ему причитается. `orders` этого не хранит.

## 3. Что в документе верно и подтверждено кодом

- Provider-agnostic платежи и entitlement — реализованы именно так, как описано (`access.ts`, `EntitlementSource`).
- Editorial approval как гейт публикации — есть (`review_status`, `courseReadiness`).
- Translation-group вместо копий продукта — есть.
- Отказ от AI-recommendation до данных — код это соблюдает (progress_events как сырьё, рекомендаций нет).
- Consult без агента/календаря (agent-contour A3) — совпадает с «Booking позже».
- WayForPay, Fondy нет — совпадает.

## 4. Рекомендации к v0.3 документа

1. **Добавить §0 «Текущее состояние кода»** с таблицей из §1 этого аудита. Агент должен видеть дельту, а не только цель.
2. **Решить 2.1 явно.** Предложение: `Experience` = расширение `lms_courses` (переименование позже), `Activity.kind` добавляется как поле к lesson/блоку с `content` по умолчанию, `live`/`human_session` — как слоты (колонка + enum, без реализации), в духе правила «слоты без реализации» из lms-research 3A. Не заводить параллельную `experience_*` схему.
3. **Снять противоречие 2.2** одной фразой: либо «билдер = internal tooling, к которому приглашённые авторы получают доступ вручную» (тогда creator-contract §1 уже это говорит и документ должен его цитировать), либо признать, что creator tooling — NOW.
4. **Run → отдельная сущность** только когда появится второй cohort одного курса. До этого — `schedule` в курсе достаточно; записать как осознанное решение.
5. **Ledger минимально:** колонки `provider_id`, `platform_share`, `provider_share` в `orders` (или view) до любого внешнего автора с продажами. Payout — вручную, как документ и говорит.
6. **Provider как таблица** до первого guest expert: profile, credentials, tradition, verified_at/by. `author_id` остаётся FK на неё или на users.
7. ~~**Исправить i18n:** `Lang = "uk" | "ru" | "en"`~~ → сделано 2026-08-27 в виде `Lang = "uk" | "en"`, default `uk`; RU снят решением владельца (§6.4).
8. **Один Offer:** план миграции `PRODUCTS` → `lms_course_offers` (или обратно), `CW_TEST_PRICE_1UAH` остаётся до закрытия QA-окна.
9. **Claims-поля и contraindications** — в NEXT с конкретным местом (поле на course/experience, не на provider).
10. Записать stress-test §12 как живую таблицу с датой прогона; сейчас 2/11.

## 5. Что документ правильно запрещает — и один пункт, который стоит добавить

К «DO NOT ASSUME» добавить:

```
× Course уже переименован в Experience — нет, ядро course-центрично.
× Builder — это internal admin tooling — нет, это отдельный домен для внешних авторов.
× Provider существует как сущность — нет, есть author_id.
× UI двуязычен uk/ru — нет: с 2026-08-27 он двуязычен uk/en, RU не существует ни на одной поверхности.
```

---

## 6. Решения владельца (2026-08-26) и видение разрешения

Четыре уточнения после первого прохода. Они меняют вес части выводов §2, поэтому фиксируются здесь, а не правкой выше.

### 6.1 Experience — это «всё на платформе», а не «переименованный course»

Принято. Тогда расхождение 2.1 — не ошибка документа, а невыбранная схема. Моё видение:

**Experience — контейнер-композиция, Course — один из видов Activity внутри неё.** Не переименовывать `lms_courses`. LMS-ядро остаётся тем, чем оно уже хорошо является: движком *content-activity* (модули, уроки, блоки, расписание, прогресс). Над ним появляется тонкий слой:

```text
experiences            — то, что человек проходит (Шлях 21)
experience_activities  — позиции композиции: kind + ссылка на исполнителя
    kind = course        → lms_courses.id          (есть)
    kind = assessment    → dosha test / будущие     (есть движок, нет ссылки)
    kind = human_session → consult lead / будущий slot (есть lead, нет slot)
    kind = live          → слот, ссылка null       (нет)
    kind = resource      → resources.id            (нет)
experience_offers      — сегодняшний lms_course_offers, FK на experience, не на course
```

Почему так, а не «course = experience с флагом»:

- **Way 21 уже сейчас** = курс + консультации + Telegram-community + травы. Это композиция из четырёх Activity разных kind. Сделать её «курсом с флагами» — значит тащить в `lms_courses` колонки про травы и слоты.
- **Билдер не ломается.** Он редактирует `course` — content-activity. Композиция Experience — другой экран (и первое время — admin/seed, не билдер).
- **Entitlement переезжает на уровень выше на одну ступень.** `resolveEntitlement(experience)` ⇒ доступ ко всем её activities. Сегодняшний `resolveEntitlement(course)` становится частным случаем: у каждого существующего курса — Experience из одной activity. Миграция — один INSERT на курс.
- **Stress-test §12 закрывается композицией, а не новыми типами:** consultation = Experience{human_session}; program+kit = {course, resource.physical}; assessment+session = {assessment, human_session}; membership = Offer с recurring-сроком поверх любой Experience; multi-author = activities с разными `provider_id`.

Что **не** делать сейчас: не реализовывать `live`, `slot`, `resource.physical` — только enum-значения и nullable FK (правило «слот без реализации», lms-research 3A).

Порядок:

1. `experiences` + `experience_activities` (только kind=course), backfill 1:1 из `lms_courses`.
2. `lms_course_offers` → `experience_offers` (или добавить `experience_id`, оставив `course_id` на переходный период). Одновременно — `PRODUCTS` из `products.ts` становится seed для этой же таблицы: **один Offer**.
3. `resolveEntitlement` принимает `experienceId`; старая сигнатура — обёртка.
4. Только после этого — вторая kind (`assessment` для dosha, потому что движок уже есть).

### 6.2 Билдер — internal tooling с правильной архитектурой

Принято: билдер — **для команды (соавтор платформы) сейчас**, а не creator self-service. Тогда противоречие 2.2 снимается формулировкой, а не переделкой. В документе v0.3 §7 должно звучать: «Experience Composer начинается как внутренний инструмент, доступ выдаётся вручную (creator-contract §1); self-service — LATER». Из кода ничего убирать не надо. Что менять в приоритетах: review-flow, version history, drafts — уже достаточно для двух человек; следующая единица работы в билдере — не новая фича редактора, а **окно композиции Experience** (6.1, шаг 1), пусть даже как admin-форма.

### 6.3 Как заложить, не перегрузив

Правило одно, оно уже принято в репо для i18n и платежей: **слот = колонка / enum / параметр; реализация = только для того, что продаётся сегодня.** Конкретно, что заложить сейчас за минимальную цену:

| Слот | Цена | Зачем |
| --- | --- | --- |
| `experiences`, `experience_activities.kind` enum | 1 миграция + backfill | корень 6.1 |
| `providers` (id, display_name, brand, verified_at, verified_by, credentials jsonb) + `lms_courses.provider_id` | 1 миграция, 1:1 с founder | Trust + ledger висят на этом |
| `orders.provider_id`, `orders.platform_share`, `orders.provider_share` (nullable) | 3 колонки | ledger без ledger; заполняется при первом guest expert |
| `experience_offers.recurring_interval`, `access_days` (nullable) | 2 колонки | membership / срок доступа |
| `experiences.claims_kind` enum (traditional / evidence_informed / medical), `contraindications` InlineText | 2 колонки | Trust §11 без UI |
| `Run` | **не заводить** | пока нет второго cohort одного курса; `CourseSchedule.start='date'` достаточно |
| Booking / slot / live | **не заводить** | только enum-значение kind |

Что **не** закладывать даже слотом: Journey/State/Outcome, recommendation, payout adapter, multi-currency витрина.

### 6.4 Язык: две локали везде, сразу

> **Решение владельца 2026-08-27 — заменяет то, что этот раздел предлагал.**
> Локалей две, `uk | en`, на всех поверхностях. `ru` не «позже» и не
> «постепенно» — его нет: админка переведена в uk целиком, а не через fallback.
> Причина простая: третья локаль стоит перевода каждой строки трижды и даёт
> поверхность, на которой никто не говорит — аудитория RU/EN глобально, а
> локальный язык продукта украинский.

Что сделано (закрыто в тот же день):

1. `Lang = "uk" | "en"` (`src/lib/i18n.ts`), `CourseLocale = "uk" | "en"`
   (`src/lms-core/course.ts`), `Locale = "uk" | "en"` (`src/lib/products.ts`) —
   три диалекта, отмеченные в `ontology-sync` №16, схлопнуты в один код `uk`.
   `normalizeLocale` по-прежнему **принимает** `ua`/`uk-ua` на входе: старые
   ссылки с `?lang=ua` не должны ломаться, но внутрь идёт `uk`.
2. Словарь `ru` переведён в `uk` строка в строку; ключей 528, паритет с `en`.
3. Default локали: `I18nProvider` → `uk`; чекаут → `uk` для UA, иначе
   Accept-Language, иначе `en` (глобальная аудитория, а не украинская).
4. Тест-гард `src/lib/i18n.test.ts`: паритет ключей `uk`/`en`, пустых значений
   нет, в `uk` не осталось русских букв `ыэъё`.
5. Миграция `2026-08-27_two_locales.sql` сужает CHECK `lms_courses.locale` до
   `('uk','en')` — иначе БД принимала бы значение, которое ридер отвергает.

Вне скоупа намеренно: `docs/design-system.styleguide.html` — внутренний
стайлгайд, написанный русской прозой; это документ для команды, а не поверхность
продукта, и `lang="ru"` там честнее, чем `uk` над русским текстом. Русские
комментарии в коде (`wfp/webhook`, `capi.ts`, `products.ts`) — по той же причине.

### 6.5 Тестовая цена

`CW_TEST_PRICE_1UAH` актуальна, QA-окно открыто. Остаётся риск, записанный в `products.ts`: квотируется 4100, списывается 1 — допустимо только пока лендинги `noindex` и без трафика. Снятие — до открытия трафика, не «когда-нибудь».

### 6.6 Что это меняет в «DO NOT ASSUME» v0.3

```text
× Experience = переименованный Course      — нет: Course = Activity.kind внутри Experience.
× Билдер = creator self-service             — нет: внутренний Composer, доступ вручную.
× Provider существует как сущность          — пока нет; заводится 1:1 с founder до первого гостя.
× UI двуязычен uk/ru                        — нет: uk/en везде, RU снят (§6.4, 2026-08-27).
× Run нужен сейчас                          — нет, до второго cohort.
```
