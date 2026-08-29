# Marketplace → Courses → Builder: mobile-first workspace and agent plan

Дата: 2026-08-23

Статус: research → migration-first execution proposal

Область: публичная витрина программ, личное обучение, авторский билдер, будущий агентный контур
Продолжает:

- `docs/lms-research-2026-08-15.md` — рыночная модель H1–H4;
- `docs/agent-contour-2026-08-21.md` — закрытые реестры инструментов A1/A2;
- `docs/lms-builder-2026-08-21.md` — реализованный билдер;
- `docs/showcase-lms-builder-research-2026-08-22.md` — стык витрины, LMS и билдера;
- `docs/lms-builder-course-lifecycle-2026-08-23.md` — review/publish/catalog lifecycle;
- `docs/personal-surface-chrome-2026-08-23.md` — граница personal shell.

Это локальный план, а не новый канон. Он сравнивает текущее состояние с целевой рабочей платформой и предлагает порядок развития. Структурные решения следует промотировать в RAverse только после проверки в реализации.

## 0. Решение в одном абзаце

Ближайшая задача CenterWay — не построить универсальную LMS для большого числа авторов, а перенести существующие курсы из внешних источников, привести их к одной редактируемой схеме и без разрыва выпустить в обучение и на маркетплейс. Поэтому билдер сначала становится **миграционно-релизным рабочим контуром** для маленькой внутренней команды. Его основная петля: `источник → импорт/нормализация → проверка структуры и медиа → правка → readiness → review → обучение + витрина`. Навигация и агентные функции добавляются только там, где они сокращают эту петлю.

CenterWay по-прежнему не нужен один большой левый сайдбар, одинаковый для всех поверхностей. Нужна одна **навигационная грамматика** с разной реализацией по контексту:

- **маркетплейс** помогает выбрать маршрут и остаётся максимально открытым;
- **курсы** помогают продолжить обучение и удерживают фокус на текущем шаге;
- **билдер** становится полноценным рабочим пространством автора с курс-локальной навигацией, состояниями готовности, review, мониторингом и контекстными инструментами;
- **агент** не становится четвёртым продуктом и не получает отдельную истину: он открывается как контекстная плоскость поверх текущей сущности, использует те же схемы, права и гейты, предлагает изменения и никогда сам не публикует.

Полнота платформы определяется не количеством постоянно видимых пунктов, а тем, что для каждой задачи есть честный маршрут, источник истины, состояние, действие и путь восстановления.

### 0.1 Исполнительный приоритет текущего цикла

До переноса основной библиотеки приоритеты такие:

1. инвентаризировать курсы и форматы источников;
2. дать каждому переносу явный статус и список потерь/пробелов;
3. свести существующие JSON- и document-import paths в один понятный вход;
4. редактировать импортированный draft теми же typed blocks, которые видит learner runtime;
5. одним release checklist доводить курс до двух результатов: `доступен в обучении` и `виден/готов к продаже на маркетплейсе`;
6. только после стабилизации конвейера добавлять мониторинг учеников, многопользовательское авторство и широкую агентную автоматизацию.

Малое число авторов — сознательное ограничение первой версии. Масштабирование обеспечивается не лишними экранами, а сохранением `author_id`, permission gates, review lifecycle, audit/version contract и owner-only коммерческих полей.

## 1. Три уровня — одна цепочка, две агентные роли

| UX-уровень | Основной пользовательский вопрос | Центр тяжести | Агентный runtime |
| --- | --- | --- | --- |
| **Marketplace** `/programs/*` | «Что мне подходит и почему?» | выбор, доверие, оффер | A2, режим гостя/покупателя |
| **Courses** `/learn/*` | «Где я и что делать сейчас?» | прогресс, урок, поддержка | A2, режим ученика |
| **Builder** `/build/*` | «Что нужно создать, исправить или выпустить?» | структура, контент, готовность, аудитория | A1, режим автора |

Три UX-уровня не требуют трёх разных агентов. Marketplace и Courses — два состояния A2, различаемые серверными правами и доступным контекстом. Builder — A1. Запись на консультацию остаётся обычным подтверждаемым действием через существующий lead-flow, а не самостоятельным агентом.

`Marketplace` в этом плане означает курируемую витрину CenterWay с собственными и допущенными авторскими курсами. Это не открытый агрегатор, не self-service multi-vendor market и не обязательство строить отдельный seller back office. Review, catalog visibility и owner-controlled offer остаются границей допуска.

## 2. Семантические контракты поверхностей

| Surface | Semantic role | User question | Token source | Content/data source | Route boundary |
| --- | --- | --- | --- | --- | --- |
| Marketplace catalog | orientation + route + offer | Что мне подходит? | global platform DS / generated runtime token pack | каталог программ, опубликованные `listed`-курсы, офферы | public platform `/programs` |
| Program/course offer | method + offer + trust + boundary | Что это, для кого и что будет после покупки? | route/token pack + platform recipes | рукописный оффер или курс из БД, цена из offer source | public platform `/programs/:slug` |
| Learning shelf | orientation + progress | Что продолжить сейчас? | global personal platform DS | свой enrollment/access/progress | personal `/learn` |
| Course map | progress + method + support | Где я внутри курса? | global personal platform DS | outline, availability, own progress | personal `/learn/:course` |
| Lesson | work + progress + care | Что сделать в этом шаге? | course theme + LMS block recipes | entitlement-protected lesson body, own progress | personal `/learn/:course/:lesson` |
| Builder shelf | orientation + status | С каким курсом работать? | global personal platform DS | доступные автору курсы, readiness/review summary | personal `/build` |
| Course workspace | method + progress + boundary | Что мешает курсу стать готовым и доступным? | builder recipes over global DS | course structure, readiness, review, visibility, offer status | personal `/build/:course` |
| Lesson editor | work + method | Что именно увидит ученик? | course theme + builder recipes | current draft, block schema, sources | personal `/build/:course/:lesson` |
| Agent panel | support + action + boundary | Что агент понял, что предлагает и что изменится? | shell/context tokens, no new palette | current authorized context + closed tool registry | contextual layer, not an independent route initially |

## 3. Что уже есть

### 3.1 Marketplace

Уже существует:

- общий public shell и platform navigation;
- `/programs` и динамический `/programs/[slug]`;
- объединение рукописных программ и `listed`-курсов из БД;
- оффер, checkout/lead fallback, ownership state;
- отдельные источники истины для содержания курса и цены;
- review lifecycle перед публикацией и выходом в каталог.

Пока нет как законченной продуктовой поверхности:

- поиска и фильтров по каталогу;
- персональной ориентации по задачам/состоянию пользователя;
- единой пользовательской классификации программ и курсов, которая не раскрывает внутреннюю техническую разницу их источников;
- режима сравнения или сохранения интереса;
- A2 для объяснения выбора по белому списку источников;
- сквозного измерения `view → offer → checkout/lead → access` для каждого DB-курса в одном авторском/админском обзоре.

### 3.2 Courses

Уже существует:

- отдельная полка `/learn`;
- карточки со статусом, прогрессом, текущим уроком и Start/Continue/Open map;
- course map с доступностью и reference-материалами;
- lesson player, drawer содержания, предыдущий/следующий шаг;
- event-based progress, checklist completion, schedule gates;
- entitlement-bound lesson API;
- напоминания и PWA-контур;
- learn-mode header, убирающий витринные выходы из урока.

Пока нет:

- персонального блока «Продолжить» над равноправной сеткой;
- группировки по `not_started / in_progress / completed / expired`;
- поиска и фильтров при росте библиотеки;
- learner-facing истории активности и ясного восстановления после паузы;
- A2 с контекстом курса/урока, цитированием разрешённых блоков и support handoff;
- явной модели «что изменилось с прошлого визита» для обновляемых курсов.

### 3.3 Builder

Уже существует:

- `/build` как отдельная авторская полка;
- создание скрытого draft, импорт/экспорт и удаление с защитами;
- структура course → module → lesson → typed blocks;
- drag-and-drop, add/delete/reorder, undo/redo;
- inline editing, preview блоков, media upload;
- navigation-only course outline в редакторе урока;
- settings sheet, readiness blockers и sticky save state;
- draft/review/changes requested/approved/published lifecycle;
- разделение author-owned fields, catalog visibility и owner-only offer price;
- API с `canEditCourse`, полной валидацией и одной дверью на запись.

Пока нет:

- единого migration workspace: источник, формат, импортированные сущности, медиа-пробелы, QA и release state сейчас не собраны в одну историю;
- создания целого course draft напрямую из набора `.md/.docx/.txt`: эти форматы уже импортируются как уроки внутрь выбранного модуля, а whole-course import принимает только канонический `Course` JSON;
- адаптеров к конкретным внешним LMS/экспортам и безопасного ZIP/media ingest;
- копирования embedded DOCX images в media storage;
- устойчивой курс-локальной карты режимов: overview/content/storefront/audience/insights/settings;
- авторского overview, который собирает readiness, review, visibility, offer и learner health в один ответ «что требует внимания»;
- author-facing списка учеников и агрегатов прогресса;
- lesson drop-off и stalled cohorts;
- versions, сравнения редакций и отката;
- autosave безопасной draft-версии;
- release batches для атомарного обновления живого курса;
- A1 panel, proposed changes, diff/review/apply и agent audit log;
- author-facing source library как законченной UI-поверхности.

## 4. Главный gap: возможности есть, рабочей карты ещё нет

Сегодня базовая навигация уже отвечает «где я», а блоки/тулы — «что можно сделать здесь». Для актуальной задачи недостаёт не общего dashboard, а сквозного ответа: **что уже перенесено, что потерялось, что блокирует выпуск и где это исправить**.

Readiness, review, visibility, offer и migration gaps относятся к одному курсу, но не к одному уроку. Если поместить их в lesson rail, навигация превратится в панель управления. Если спрятать всё за gear, автор не увидит проблемы. Поэтому первая рабочая версия получает компактный course overview и release checklist. Learner progress и широкая аналитика остаются следующим слоем после переноса библиотеки.

### 4.1 Фактическая матрица переноса

| Вход | Что есть сейчас | Ближайшее решение |
| --- | --- | --- |
| Канонический `Course` JSON | whole-course preview + commit; создаёт новый hidden draft с новыми ID | сохранить как точный перенос и эталонный внутренний формат |
| `.md/.markdown`, `.docx`, UTF-8 `.txt` | массовый импорт уроков внутрь выбранного модуля; один файл = один урок | поднять в единый import entry и показать mapping до commit |
| Embedded images из DOCX | в media storage не копируются | явный blocker + media reconciliation queue; не допускать тихой потери |
| Внешние LMS export/HTML/CSV/ZIP | прямого адаптера нет | сначала реестр источников; затем адаптер только для повторяющегося формата |
| Видео, файлы и внешние URL | могут существовать как ссылки/typed blocks, но перенос зависит от исходного формата | manifest/media map + проверка доступности и прав |

AI не должен быть первым импортёром. Детерминированный parser сохраняет структуру и фиксирует потери; A1 позже предлагает mapping, заголовки, типы блоков и список недостающего, но человек видит diff и подтверждает запись.

## 5. Целевая навигационная грамматика

### 5.1 Четыре плоскости

| Плоскость | Что в ней живёт | Что в ней не живёт |
| --- | --- | --- |
| **Application chrome** | витрина / моё обучение / билдер / аккаунт | свойства курса, аналитика урока, agent thread |
| **Context navigation** | текущий курс, его режимы и outline | формы, графики, destructive actions |
| **Workspace** | текущая задача и одно главное действие | глобальное приложение, длинная вторичная навигация |
| **Context tools** | свойства выбранного блока, agent, preview, history | самостоятельная новая истина или второй publish path |

Application chrome остаётся минимальным. Context navigation появляется только там, где пользователь уже выбрал сущность и глубина оправдывает постоянную карту.

### 5.2 Attention model

В навигации показываются только сигналы, которые меняют следующий шаг:

- active/current;
- draft/unsaved;
- blocker/error;
- review requested/changes requested;
- locked/unavailable;
- count, только если он требует действия.

В sidebar не показываются сырые метрики, графики и длинные статусы. `63% completion` живёт в overview/insights; красная метка `12 stalled` может вести туда из навигации.

## 6. Целевая модель Marketplace

### 6.1 Navigation

Постоянный левый sidebar маркетплейсу сейчас не нужен. Public header уже отвечает за мастер-экосистему, а каталог должен оставлять ширину карточкам и объяснению выбора.

Целевой порядок:

1. понятный заголовок и один вопрос выбора;
2. компактные route chips или topics;
3. персональный/редакционный блок рекомендации;
4. каталог;
5. filters/search только после появления реальной плотности;
6. support/consult path.

Фильтры на mobile открываются bottom sheet. На desktop отдельная filter rail появляется только при устойчивой необходимости в нескольких независимых фасетах; она не становится глобальной навигацией.

### 6.2 Agent entry

A2 открывается не как плавающий чат, конкурирующий с CTA, а как явное вторичное действие `Допомогти обрати маршрут` рядом с точкой выбора.

Разрешённый результат:

- задать 2–4 вопроса о цели и предпочтительном формате;
- объяснить различия продуктов и курсов по утверждённым данным;
- предложить доша-тест, программу, страницу оффера или консультацию;
- показать, на каких данных основана рекомендация;
- передать человеку вопросы о здоровье, оплате и противопоказаниях.

Запрещённый результат:

- медицинский совет;
- придуманная цена, скидка или обещание;
- пересказ закрытого урока;
- автоматическая заявка без подтверждения.

## 7. Целевая модель Courses

### 7.1 Shelf

До 5 активных курсов полке не нужен sidebar. Нужна иерархия:

1. один доминирующий `Продовжити` по последней релевантной активности;
2. остальные активные курсы;
3. не начатые;
4. завершённые/архивные.

При 6–12 курсах добавляются search и status tabs. Filter rail рассматривается только при 12+ курсах, нескольких типах продукта или устойчивом запросе на topics — это продуктовый порог для проверки, не каноническая константа.

### 7.2 Course map and lesson

Course map остаётся самостоятельным обзором. В уроке curriculum открывается как drawer на mobile и как спокойная navigation rail на широком экране только если это не сокращает рабочую область ниже читаемой меры.

В lesson chrome остаются:

- текущий шаг;
- progress/availability;
- contents;
- previous/next или Complete and continue;
- support.

Marketplace navigation и cross-sell не возвращаются внутрь урока.

### 7.3 Learner agent

A2 в курсе открывается из `Пояснити / Запитати` и получает явный scope chip:

- `Цей урок`;
- `Цей курс`;
- `Мій прогрес`.

Ответ должен ссылаться на разрешённый lesson/course fragment. Для гостя тот же инструмент не может читать тело урока; UI не скрывает эту разницу мягким текстом, а честно предлагает открыть купленный курс или страницу программы.

Запись ограничена двумя подтверждаемыми действиями: support handoff и consult request. Изменять прогресс за ученика агент не может.

## 8. Целевая модель Builder

### 8.1 Course-local navigation

До завершения миграции курс получает только три постоянно различимых режима. На desktop они могут жить в компактной rail; на mobile — в drawer/sheet. Rail не редактирует сущности, а ведёт к режимам:

| Mode | Что отвечает |
| --- | --- |
| **Курс** | Откуда он перенесён, что требует внимания и каков статус двух выходов? |
| **Зміст** | Как устроены модули/уроки, что импортировать и что править? |
| **Випуск** | Что блокирует review, обучение и витрину; какие storefront/access поля ещё нужны? |

Редкие свойства остаются в settings sheet. Внутри `Зміст` rail раскрывает module/lesson outline, а import entry доступен на уровне курса и модуля. Add/delete/reorder остаются в workspace, чтобы навигация не стала вторым неполным редактором. `Учні`, `Прогрес`, отдельные `Джерела`, team management и revenue не становятся nav items до появления устойчивой операционной потребности.

Первый реализованный срез использует узкую rail только там, где она действительно экономит повторные поиски: на wide desktop это `Курс / Зміст / Випуск` плюс draft/blocker health внизу. Rail размещается в свободном внешнем gutter общего platform container, а не становится колонкой сетки: topbar, loading, полка и документ сохраняют одну ширину и одну ось. На промежуточном desktop режимы возвращаются в строку над документом; inspector, release и будущий agent всегда overlay, поэтому их открытие не сдвигает рабочий лист. На mobile rail исчезает: режимы становятся короткой строкой, release health располагается после структуры, детали открываются в bottom sheet. Основной workspace выглядит как бумажный рабочий лист с hairline-рядами; `Ряди / картки` — представления одной структуры, не разные модели данных. Текстовые действия редактирования заменены карандашом, drag-grip стоит рядом с сущностью. Общий platform ink-language теперь различает текстовый `ink-stroke` и icon-only `ink-ring`; небольшие baked капли добавляют живость без runtime-фильтров и без превращения интерфейса в иллюстрацию.

### 8.2 Overview

Overview — не generic dashboard. На текущем этапе он отвечает «что делать дальше, чтобы перенести и выпустить курс» в порядке риска:

1. unsaved/conflict;
2. import status и неразобранные файлы;
3. structure/media/content gaps;
4. readiness blockers;
5. review status и комментарий;
6. learning release state;
7. marketplace visibility/offer state.

Минимальный migration/release health:

- source label и дата/способ последнего импорта;
- imported/skipped/warning/error counts;
- missing/remote media и broken links;
- draft/review/published;
- hidden/unlisted/listed;
- offer active/inactive, price read-only для автора;
- blockers by location;
- learning runtime result;
- marketplace result;
- версия/ревизия, которая обслуживает learners, после появления version safety.

### 8.3 Единый import entry

На `/build` primary actions остаются `Створити курс` и `Імпортувати`. Импорт не раскрывает пользователю внутренние API, а предлагает два честных сценария:

1. **Перенести точную копию** — canonical `Course` JSON → preview → новый hidden draft.
2. **Собрать курс из материалов** — создать/выбрать draft → выбрать модуль → добавить `.md/.docx/.txt` → preview mapping → import → продолжить разбор следующего модуля.

До появления надёжного folder/ZIP adapter второй сценарий не обещает автоматическое восстановление всей иерархии курса. Он сохраняет файлы в уроки, показывает, что не перенеслось, и оставляет группировку модулей человеку. Для повторяющегося внешнего экспорта сначала пишется отдельный adapter в canonical format, а не новая параллельная модель данных.

### 8.4 Один checklist — два выхода

`Випуск` показывает две независимые, но связанные цели:

- **Обучение готово**: course approved/published, lesson runtime валиден, расписание/access согласованы, нужные enrollment/entitlement paths работают;
- **Маркетплейс готов**: course approved/published, storefront content заполнен, visibility соответствует намерению, owner-controlled offer активен и цена приходит из offer source.

Кнопки не имитируют один магический publish. UI показывает, какой gate требует автора, reviewer/admin или owner. После действия выполняется read-after-write verification обеих поверхностей: открывается/проверяется learner route и catalog/offer route в соответствии с правами и visibility.

### 8.5 Context tools

Block/lesson properties открываются в правом inspector на wide desktop и в sheet на tablet/mobile. Settings остаются редким режимом. Preview и history — инструменты, а не разделы навигации.

На широком экране возможны три колонки только по необходимости:

- navigation rail;
- workspace;
- inspector **или** agent panel.

Inspector и agent не открываются одновременно. Иначе пользователь получает две конкурирующие правые панели и менее половины ширины для документа.

### 8.6 Route strategy

Первый этап не должен ломать существующие URL:

- `/build` — shelf;
- `/build/:course` — overview + structure workspace;
- `/build/:course/:lesson` — editor.

Новые режимы сначала могут открываться как stateful panels/sheets с URL search params, чтобы back/forward сохранял контекст. Когда Students/Insights/Sources станут самостоятельными тяжёлыми поверхностями, безопасное расширение — namespaced routes вида `/build/:course/manage/:section`. Это избегает конфликта с существующим `:lesson`, где slug может совпасть со словом `settings` или `students`.

## 9. Agent plane: общий UX-контракт

### 9.1 Один паттерн на трёх уровнях

| Свойство | Marketplace A2 | Courses A2 | Builder A1 |
| --- | --- | --- | --- |
| Scope | каталог/тест/оффер | курс/урок/свой прогресс | курс/модуль/урок/выбранные блоки/источники |
| Default | read-only | read-only | propose-only |
| Write | confirm consult/support | confirm consult/support | apply reviewed draft through `course.write` |
| Never | закрытый контент, медицина, цены от модели | чужой прогресс, медицина | publish, price, access, orders, roles |
| Evidence | ссылки на product/course facts | разрешённые fragments | sources + target paths + readiness |
| Recovery | handoff | handoff | discard, undo/version restore, audit log |

### 9.2 Panel anatomy

Agent UI всегда показывает:

- контур: `Помічник платформи` или `Помічник автора`;
- текущий scope;
- источники/вложения;
- что было прочитано;
- что предлагается изменить;
- статус инструментов;
- цену/лимит операции, если задача широкая;
- явные `Review`, `Apply`, `Discard` для записи;
- историю подтверждённых действий.

Для builder-agent ответ «готово» недостаточен. Результат записи — proposed change set с target paths, before/after и новыми readiness blockers. Применение создаёт draft/version, но не publication.

### 9.3 Почему agent не навигация

Agent может быть открыт из разных экранов и менять scope вслед за текущей сущностью. Если сделать его пунктом sidebar, пользователь будет уходить с контекста в отдельный чат и снова объяснять, о каком уроке речь. Правильная модель — collapsible side panel на desktop и full-height bottom sheet на mobile с видимым контекстом.

## 10. Mobile-first contract

QA проводится минимум на `375 / 768 / 1024 / 1440`. Реализация может сохранять существующую границу builder rail `901px`, пока поведение проверено на этих контрольных ширинах.

### Phone

- persistent sidebar отсутствует;
- один компактный application header;
- context navigation открывается кнопкой рядом с trail/title;
- drawer/sheet занимает до `100svh`, имеет focus trap, Escape/backdrop close и возвращает фокус;
- agent открывается как отдельный full-height sheet;
- sticky bottom action bar несёт максимум одно primary action;
- block tools появляются только для выбранного блока;
- интерфейс не требует hover и не имеет горизонтального скролла;
- software keyboard не перекрывает input, Apply/Save и agent composer.

### Tablet

- context rail может быть drawer или временной колонкой;
- workspace остаётся доминирующим;
- inspector и agent — overlay/sheet, не третья постоянная колонка;
- drag-and-drop всегда имеет button/keyboard fallback.

### Desktop

- course-local rail становится sticky и independently scrollable;
- workspace сохраняет readable measure;
- inspector/agent открывается по запросу;
- wide desktop допускает три зоны, но только с одной правой панелью.

## 11. Capability matrix: сейчас → полноценная платформа

Обозначения: `есть` — рабочий контур; `частично` — данные или UI существуют, но не собраны в продуктовый сценарий; `нет` — отдельная будущая возможность.

| Capability | Сейчас | Target |
| --- | --- | --- |
| Public/personal application split | есть | сохранить, не смешивать словари витрины и «моего» |
| Marketplace catalog + DB courses | есть | search/topics/filter when density proves need |
| Dynamic course offer | есть | единая наблюдаемость view→purchase→access |
| Marketplace personalization | нет | rule-based first, A2 explanation later |
| Learning shelf | есть | Continue-first + state grouping |
| Course map and lesson drawer | есть | desktop rail only where measure permits |
| Own progress | есть | activity history + recovery after pause |
| Builder shelf | есть | filters/statuses only when author portfolio grows |
| Course structure/editor | есть | preserve central workspace ownership |
| Whole-course canonical JSON import | есть | единый import entry + migration receipt |
| Bulk lesson documents | есть | preview mapping + явные media/content warnings |
| External LMS adapters | нет | только для подтверждённых повторяющихся форматов |
| Migration register | нет | source → import → QA → release status per course |
| Readiness/review/publish | есть | consolidate in course overview and attention signals |
| Storefront settings | частично | собрать с release gates в `Випуск`, не плодить nav |
| Author learner monitoring | частично: data exists elsewhere | course-scoped learners + stalled/drop-off |
| Versions/rollback | нет | prerequisite for A1 writes to live courses |
| Autosave | нет | draft/version autosave with visible timestamp |
| Release batch | нет | atomic update and scheduled release later |
| Source library | частично | author-facing sources, provenance, whitelist |
| A2 marketplace | нет | read-only catalog assistant first |
| A2 learner | нет | entitlement-aware citations + handoff |
| A1 author | contract only | propose → review → apply draft → audit |
| Agent observability | contract only | runs/messages/tool results/cost/retention |
| Autonomous publishing | intentionally absent | remain absent |

## 12. Roadmap and dependencies

### M0 — Реестр переноса и baseline

Цель: видеть весь объём работ до изменения интерфейса.

- заполнить `docs/course-migration-runbook-2026-08-23.md` реальными курсами и источниками;
- для каждого источника зафиксировать export format, структуру, медиа, права и owner;
- выбрать один простой и один сложный pilot course;
- снять baseline: сколько ручных шагов, где теряются структура/медиа, сколько времени до editable draft и до двух live outputs;
- не строить adapter, пока один и тот же формат не повторяется или ручной перенос не доказанно дорог.

Exit: у каждого курса есть owner, source package, target slug, migration state и следующий blocker.

### M1 — Надёжный импорт и migration receipt

Цель: ни один перенос не завершался молча или с неучтённой потерей.

- объединить существующие whole-course JSON и lesson-document paths одним import entry;
- добавить preview mapping для files → lessons/modules;
- сохранять migration receipt: источник, время, импортировано/пропущено, warnings/errors;
- сделать media reconciliation явной очередью;
- добавить adapters только для выбранных повторяющихся источников;
- все выходы adapters валидировать тем же canonical course schema.

Exit: оператор без разработчика создаёт editable hidden draft, а все неперенесённые элементы перечислены и локализованы.

### M2 — Migration-first workspace

Цель: быстро исправлять импортированный курс без mega-sidebar.

- три режима `Курс / Зміст / Випуск`;
- overview с import gaps, readiness и двумя release states;
- import на уровне курса/модуля;
- структура и typed-block editor остаются главным workspace;
- settings — sheet, не постоянный раздел;
- mobile drawer проходит keyboard/focus/reflow QA; file import работает из Files picker;
- URL-state переживает reload/back.

Exit: с телефона или desktop оператор находит любой import blocker и место исправления максимум за три действия.

### M3 — Release conveyor и сквозная проверка

Цель: довести draft до обучения и маркетплейса без ручного угадывания состояний.

- единый release checklist поверх существующих readiness/review/publish/visibility/offer contracts;
- явная ответственность author vs reviewer/admin vs owner;
- storefront completeness рядом с catalog state;
- verification learner runtime после публикации;
- verification catalog/offer state после visibility/offer changes;
- audit результата по каждому курсу в migration register.

Exit: курс имеет доказанные состояния `learning live` и `marketplace live/intentional hidden`, а не только успешный save.

### M4 — Version safety before agent writes

Цель: сделать live authoring обратимым.

- immutable versions/history;
- safe autosave into draft version;
- compare and restore;
- optimistic concurrency/version conflict UI;
- change log by human/import/agent;
- позже — release batch for multi-lesson updates.

Exit: любое изменение A1 можно показать до применения и откатить после.

### M5 — Минимальный post-launch monitoring

Цель: после переноса видеть только операционные сигналы, которые требуют действия.

- enrolled/not started/in progress/stalled/completed;
- last learner activity и проблемный урок;
- небольшой course-scoped список, без общего analytics suite;
- отдельные Students/Progress modes появляются только если данные перестают помещаться в overview.

Exit: маленькая команда находит остановившихся учеников и проблемный урок без admin panel.

### M6 — A1 migration assistant

Цель: ускорять повторяющуюся нормализацию, не делегируя агенту публикацию или медицинский контент.

- сначала immutable versions, compare/restore и audit;
- scope: выбранные source files, course/module/lesson и import warnings;
- предложить mapping файлов, заголовков и typed blocks;
- найти дубли, пустые/битые ссылки и структурные пробелы;
- proposed change set → review → apply draft through `course.write`;
- human-only review submit/publish остаётся неизменным.

Exit: A1 сокращает ручную разметку, но каждое изменение обратимо и связано с источником.

### M7 — A2 read-only foundation

Цель: отладить agent runtime без записи.

- `agent_runs` and `agent_messages`;
- closed tool registry;
- rate/token limits;
- marketplace catalog/test explanation;
- entitlement-aware course/lesson reading;
- citations and boundary responses;
- no consult/support writes yet;
- mobile agent sheet and context selector.

Exit: unauthorized tool/read attempts fail server-side; каждый ответ показывает scope/evidence или честно сообщает ограничение.

### M8 — A2 confirmed handoff

- support handoff with transcript;
- consult request with explicit confirmation;
- money/health/two-fail escalation triggers;
- abuse and budget monitoring.

Exit: ни одна внешняя запись не происходит без видимого подтверждения человека.

### M9 — Explicit workflows, not autonomous agents

- declarative event workflows only after observability and audit;
- examples: `lesson.completed → notification`, `stalled threshold → queue support suggestion`;
- agent may propose a workflow, but human enables it;
- no background content edits or publishing.

Exit: automation is visible, disableable, auditable and bounded by the same event/data contracts.

## 13. Metrics and acceptance criteria

### Marketplace

- time/steps to a relevant program page;
- catalog → offer and offer → checkout/lead;
- A2 recommendation click-through, measured separately from organic navigation;
- escalation rate and unsupported-answer rate;
- zero model-originated prices/medical claims.

### Courses

- time to resume from `/learn`;
- day-1 activation;
- return interval and completion;
- stalled recovery after reminder/support;
- lesson find time;
- zero unauthorized lesson-body reads.

### Builder

- доля инвентаризированных курсов и доля с полученным source package;
- time from source package to editable hidden draft;
- import warnings resolved / intentionally accepted;
- media and link losses discovered before publish = 100%;
- time to first publishable draft;
- time from approved draft to verified learning + marketplace result;
- blockers resolved per session;
- review cycles and time in `changes_requested`;
- unsaved-loss incidents = 0;
- mobile horizontal overflow = 0;
- author can reach any course mode in ≤3 actions;
- A1 proposed-change acceptance, partial acceptance and restore rate.

### Agent system

- tool success/failure by contour;
- server-blocked unauthorized attempts;
- answers with valid evidence;
- human confirmation rate for writes;
- cost per resolved task;
- support handoff quality;
- no publish tool exposed;
- audit reconstruction possible for every applied A1 change.

## 14. Что не делать

- не копировать SendPulse-style mega-sidebar;
- не строить multi-author SaaS, team roles, comments, assignments, revenue dashboards и сложную аналитику до переноса основной библиотеки;
- не обещать автоматический whole-course import из произвольного формата;
- не скрывать skipped blocks, embedded images и broken links за общим статусом `успешно`;
- не делать одинаковую navigation для marketplace, learner и author;
- не ставить плавающий agent bubble на каждый экран;
- не смешивать analytics с navigation;
- не добавлять permanent right inspector на phone/tablet;
- не давать агенту raw DB, arbitrary fetch, SQL или publish;
- не ставить A1 перед детерминированным import pipeline и не давать ему писать до versions/audit/review UI;
- не использовать agent для интерпретации здоровья или доша-результата;
- не делать RAG по всему сайту и `docs/legacy/**`;
- не создавать отдельный agent-specific content schema;
- не добавлять routes/разделы только потому, что они есть у all-in-one LMS.

## 15. Рыночные подтверждения

- Thinkific New Course Builder сочетает curriculum, центральный lesson canvas, правое content/settings menu, autosave status, preview и отдельные settings/landing modes: [official guide](https://support.thinkific.com/hc/en-us/articles/37783573725463-How-to-Add-Content-and-Configure-Your-Course-in-the-New-Course-Builder).
- Circle разделяет lesson editor и course dashboard; dashboard отвечает за students, progress, comments и quiz results, а editor — за контент: [lesson editor](https://help.circle.so/p/courses/course-setup/create-course-content-using-the-lesson-editor), [course dashboard](https://help.circle.so/p/courses/course-management/using-the-course-dashboard).
- Teachable держит progress, curriculum и locked/dripped state в learner course sidebar, а не в общей библиотеке: [course navigation](https://support.teachable.com/en/articles/11682425-navigate-and-view-course-content).
- Thinkific learner dashboard ставит last accessed первым, меняет Start/Resume/Replay и добавляет search/progress filtering при росте библиотеки: [student dashboard](https://support.thinkific.com/hc/en-us/articles/1500001538961-The-Classic-Student-Dashboard).
- Kajabi выносит product progress в отдельную analytics surface с product/segment/customer drill-down: [product progress report](https://help.kajabi.com/articles/analytics/report-product-progress).
- Sanity Content Agent показывает актуальный agentic-authoring pattern: visible context, collapsible panel, separate search/proposed changes, review before apply, same permissions, no automatic publish: [Content Agent](https://www.sanity.io/docs/content-agent/introduction).
- Sanity Content Releases подтверждает необходимость preview/validation и атомарного выпуска согласованных изменений: [Content Releases](https://www.sanity.io/docs/user-guides/content-releases).

## 16. Canon-sync decision

Сейчас документ остаётся local proposal. В RAverse пока не переносить конкретные labels, breakpoints, route shapes и phase ordering.

После реализации и проверки следует рассмотреть promotion трёх устойчивых правил:

1. один platform domain — разные context navigation по задачам marketplace/learner/author;
2. agent — контекстная tool plane с human review, а не независимая surface/source of truth;
3. author agent writes only to reversible draft/version, publication remains human-only.
