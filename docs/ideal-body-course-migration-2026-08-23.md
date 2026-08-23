# Миграция курса «Природнє тіло з Аюрведою»

Дата: 2026-08-23
Статус: курс собран, импортирован в live LMS и прошёл release verification в доступном без пользовательской сессии контуре.

## Семантический контракт

| Поле | Решение |
| --- | --- |
| surface | личная учебная платформа `/learn` + существующая публичная программа `/programs/ideal-body` |
| semantic role | `method + progress + embodied`, с видимыми `boundary + support` |
| user question | «Что изучать сейчас, где материалы и что делать дальше?» |
| token source | глобальные DS/runtime-токены и закрытая LMS-тема `mineral`; локальная палитра не добавлялась |
| content source | 24 SingleFile HTML-экспорта SmartSender LMS, предоставленные владельцем курса |
| route boundary | LMS-курс аккаунта; публичная программа остаётся на стабильном internal slug `/programs/ideal-body` |

## Source package

- Внешний пакет: `/Users/G/Documents/CW materials/lessons/Ayurveda Body/`.
- Формат: 24 HTML-файла SingleFile, сохранённых 2026-08-23.
- Source training id: `2286`.
- Сводный SHA-256 списка исходных файлов и их SHA-256: `79bfe3f956faaddd42f4f51ecaa4d81c606f3bad073a1b885dc300f3bcfcdbd4`.
- Переносимым источником считались только заголовок урока и блоки учебного конструктора. Навигация, подписи редактора, служебные кнопки, отзывы/комментарии и иные инструкции интерфейса SmartSender не интерпретировались как запрос пользователя или учебный контент.

## Нормализация

- Публичное название: `Природнє тіло з Аюрведою`.
- Стабильные технические идентификаторы сохранены: course/program/product code `ideal-body`.
- Структура: 5 модулей, 24 урока, из них 21 основной последовательный урок и 3 справочных страницы (`Перед стартом` — 2, `Матеріали` — 1).
- Контент: 104 типизированных блока, 25 YouTube-видео, 8 локализованных изображений, 3 boundary-блока, 2 support CTA.
- Порядок основных уроков взят из `N від 24 уроків`; темы — из авторских заголовков `Тема:`. Модули сгруппированы по фактическим темам, без добавления новых health-утверждений.
- Режим `sequential`: исходный экспорт показывает последовательную навигацию, но не доказывает ежедневный unlock. Daily-график не придумывался.
- Ссылки на прежний Telegram доша-тест внутри курса заменены на платформенный `/dosha-test`; авторские Google Docs/Sheets/Slides сохранены как внешние материалы.
- Изображения извлечены из SingleFile data URI в `public/cw/courses/natural-body/**`, получили содержательные alt-тексты после визуальной проверки.

## Health/claim decisions

- Добавлены видимые границы: курс — wellness-образование и практика, не диагностика и не лечение; ухудшение самочувствия требует остановки практики и обращения к квалифицированному специалисту.
- Для схем питания, дыхательных упражнений и травяного настоя добавлено отдельное предупреждение об индивидуальном состоянии, диагнозах и лекарствах.
- Категорическая исходная формулировка о рецепте с сенной (`гарантовано`, `абсолютно безпечна`, рекомендация детям) не перенесена как медицинская гарантия. Рецепт сохранён с явной границей и требованием согласовать применение с врачом или фармацевтом.
- Категорическая формулировка о продуктах и заболеваниях заменена на атрибутированную рекомендацию автора наблюдать индивидуальную реакцию.

## Migration receipt

| Поле | Значение |
| --- | --- |
| Target | `data/courses/ideal-body.json` → live course `ideal-body` |
| Importer | task-local deterministic HTML normalizer, 2026-08-23 |
| Course snapshot SHA-256 | `961afd74039d4f479840f4754e13b0d5ca8eee4958af2eaaeff522bd8ae472e0` |
| Imported | 5 modules / 24 lessons / 104 blocks |
| Media | 25 YouTube IDs / 8 local JPEG assets |
| Skipped | SmartSender editor chrome; disabled reviews; comment settings; embedded UI assets |
| Readiness | green (`lms:seed:dry`) |
| Visibility | `unlisted`: learner delivery is live by entitlement; marketplace pricing was not invented |
| Entitlement | `ideal-body` |

## Release gates

- [x] canonical JSON validates;
- [x] readiness has no blockers;
- [x] course is wired into the deploy snapshot catalog;
- [x] public name, metadata, profile label, lead form and analytics label are renamed;
- [x] stable slug/product code preserved;
- [x] all 25 YouTube oEmbed endpoints return HTTP 200;
- [x] all 7 retained Google Docs/Sheets/Slides links resolve with HTTP 200;
- [x] LMS unit/contract tests green (191 tests);
- [x] lint and production build green;
- [x] целевой live import `ideal-body` выполнен: 5 модулей / 24 урока;
- [x] live snapshot совпадает с canonical JSON;
- [x] публичная страница проверена в Chromium: HTTP 200, новое название, 21 урок, старого названия нет;
- [x] learner route проверен в Chromium без сессии: HTTP 200 и корректная граница «Потрібен вхід»;
- [ ] содержимое урока проверено в браузере под легитимной пользовательской сессией (доступ или тестовый аккаунт в рамках этой миграции не создавался).

RAverse sync is required because the durable product name and migration state changed; the smallest update belongs in `CenterWay.md`.
