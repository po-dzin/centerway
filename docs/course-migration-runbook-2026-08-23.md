# Course migration runbook: source → Builder → Learning + Marketplace

Дата: 2026-08-23

Статус: local operational template
Связанный план: `docs/platform-workspace-agent-plan-2026-08-23.md`

## 1. Цель

Перенести существующие курсы из внешних источников в каноническую Course-схему CenterWay, сделать их полностью редактируемыми в Builder и доказанно вывести в нужные конечные состояния:

- `Learning live` — ученик с корректным доступом может открыть карту курса и уроки;
- `Marketplace live` — курс виден на витрине и имеет согласованный offer;
- либо `Intentional hidden` — скрытие является явным решением, а не незавершённостью.

Перенос считается завершённым не после загрузки файлов, а после content/media QA, readiness, review и проверки обеих целевых поверхностей.

## 2. Реестр курсов

Заполнить до выбора адаптеров и изменения Builder UI. Один курс — одна строка.

| Course | Source system/owner | Source URL/package | Export format | Modules / lessons | Media | Rights confirmed | Target slug | Migration state | Next blocker | Learning | Marketplace |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| _Заполнить_ |  |  |  |  |  |  |  | `discovered` |  | `not_checked` | `not_checked` |

Допустимые значения `Migration state`:

`discovered → exported → normalized → imported_draft → content_qa → media_qa → readiness_green → review_approved → released → verified`

Если курс остановлен, state не меняется, а `Next blocker` содержит конкретную сущность и ответственную роль.

## 3. Решение по способу переноса

| Условие | Путь |
| --- | --- |
| Есть валидный canonical `Course` JSON | whole-course preview → commit → hidden draft |
| Материалы представлены `.md/.docx/.txt` | создать/выбрать draft и модуль → preview files → bulk lesson import |
| Несколько курсов имеют один стабильный export format | написать один deterministic adapter → canonical JSON → штатный import |
| Формат единичный или непредсказуемый | подготовить документы вручную; не создавать одноразовую платформенную абстракцию |
| Есть embedded/remote media | создать media map; перенести/перепривязать отдельно; проверить права и доступность |

## 4. Source package contract

Для каждого курса сохранить рядом или в связанном операционном хранилище:

- исходный экспорт без изменений;
- manifest: название, язык, source owner, дата экспорта, предполагаемый target slug;
- порядок модулей и уроков;
- media map: source URL/file → target asset/block → статус;
- список того, что parser не поддержал;
- migration receipt после импорта.

Не включать секреты, персональные данные учеников и закрытые коммерческие данные в content package.

## 5. Migration receipt

Минимальная запись одного import run:

| Поле | Значение |
| --- | --- |
| Course / target draft |  |
| Source package + checksum/version |  |
| Importer/adapter version |  |
| Started / completed |  |
| Modules/lessons/blocks imported |  |
| Files/blocks skipped |  |
| Warnings/errors |  |
| Missing/remote media |  |
| Broken/unchecked links |  |
| Human decisions |  |
| Resulting draft/version |  |

Правило: `success with warnings` не равен готовности к release. Каждое warning должно быть исправлено либо явно принято с причиной.

## 6. QA gates

### Structure and content

- название, slug, язык и краткое описание корректны;
- модули/уроки расположены в исходном порядке;
- тип reference/daily и расписание не придуманы импортёром;
- headings, lists, quotes, tasks, code and links не потеряли смысл;
- нет пустых, дублированных или ошибочно объединённых уроков;
- health-sensitive claims не создавались и не усиливались AI/adapter.

### Media

- каждое исходное изображение/видео/файл имеет target или записанный exception;
- embedded DOCX images проверены отдельно;
- remote URLs доступны без авторской сессии либо перенесены в разрешённое storage;
- alt/label и права использования подтверждены;
- broken links отсутствуют или имеют согласованную замену.

### Builder and learner runtime

- импортированный курс открывается как editable hidden draft;
- save/reload не меняет порядок и block payloads;
- readiness показывает реальные blockers и становится green только после их устранения;
- lesson preview соответствует learner rendering;
- mobile не требует horizontal scroll и позволяет пройти ключевые lesson actions.

### Release

- review approved после последней content change;
- publish state подтверждён чтением после записи;
- learner с нужным entitlement открывает course map и урок;
- пользователь без entitlement не получает lesson body;
- storefront fields заполнены;
- visibility соответствует намерению;
- offer active/price подтверждены owner source;
- catalog и dynamic offer route проверены после выпуска.

## 7. Pilot sequence

1. Заполнить реестр всех известных курсов без попытки сразу их переносить.
2. Выбрать простой pilot: мало уроков, один тип документов, мало медиа.
3. Пройти полный путь до verified Learning и Marketplace; записать ручные шаги и потери.
4. Выбрать сложный pilot: несколько модулей, разные blocks, embedded/remote media.
5. Только после двух pilots определить, нужен ли адаптер, единый import wizard или достаточно улучшить preview/receipt.
6. Переносить библиотеку партиями; после каждой партии закрывать QA и release, а не накапливать непроверенные drafts.

## 8. Что масштабировать позже

После переноса основной библиотеки и появления реальной нагрузки можно добавлять:

- batch import и повторно используемые source adapters;
- роли нескольких авторов, assignments и комментарии;
- отдельные Students/Progress surfaces;
- versioned release batches;
- A1 для mapping/normalization с diff и audit;
- A2 поверх только approved/published knowledge.

До этого масштабируются контракты данных, права и audit trail, а не количество постоянно видимых разделов.
