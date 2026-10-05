# Метааудит платформы — 2026-10-04

Статус: local-only audit evidence. Проверяемый срез: `origin/main`,
`016b5a3413fbd33fc923b46cd0c4a262e47807c1` (merge PR #312).

## Вывод

Сборка, статические проверки, локальный browser smoke возврата из оплаты и
сверка production-журнала миграций проходят. Полный тестовый гейт на текущую
дату красный: 1982/1983 теста проходят. Основной системный разрыв — документы
управления описывают предыдущую архитектуру и не обеспечивают достоверную
связь канон → текущий код → выполняемая проверка. Зелёный CI не доказывает
актуальность shared canon и не отменяет выявленное падение теста после смены даты.

## Срез и метод

- Получен `main` командой `git fetch origin main`.
- Аудит проведён в чистом отдельном worktree на точном SHA, зависимости установлены через `npm ci` по его lockfile.
- Исходное рабочее дерево оставлено на `claude/offer-builder-formats-pahu20`: незакоммиченная правка `docs/creator-admission-2026-09-07.md`, `.agents/skills/` и `.codex/` сохранены. Локальный `main` уже занят другим worktree; его checkout не изменялся.
- Прочитаны точки входа канона, «Мета-аудит», «Архитектура», «Реестр», «Миграция и SQL», «Релизный чеклист», «UI-UX канон», local preflight и ADR-0001/0004; проверены frontmatter и ссылки активных canon notes.
- Проверены CI workflows, enforcement-скрипты, маршруты платформы, guards авторизации admin, cron и платёжный контур в пределах имеющихся тестов.
- Основной полный тестовый прогон повторён на Node 24.19.0, соответствующем major `.nvmrc`: ошибка воспроизводится. Первый прогон и сборка выполнены на Node 25.2.1; Next 16.3.8.
- Production проверялся только на чтение: версии миграционного журнала, имена и наличие SQL statements. Пользовательские данные не выгружались.
- UI, runtime, SQL и shared canon в рамках аудита не изменялись. Semantic-role/selection-family preflight для изменяемых UI-контролов неприменим: таких изменений нет.

## Проверки

| Проверка | Результат | Ограничение / доказательство |
| --- | --- | --- |
| `npm ci` | PASS | 454 пакета по lockfile main |
| `npm run verify:guards` | PASS | Все 26 gates, включая canon, tokens, DS, semantic, generator, ESLint, admin authz |
| `npm run lint` | PASS с warning | `PlatformAccountMenu.tsx:287`: внутренний переход через `window.location.assign` |
| `npm run typecheck` | PASS | `tsc --noEmit` |
| `npm run build` | PASS | Сборка без секретов БД; страницы использовали предусмотренные fallback; это не проверка наполнения production |
| `npm run test:coverage` | FAIL | 197/198 файлов, 1982/1983 теста; то же на Node 24.19.0; полный coverage gate не подтверждён |
| `npm run smoke:thanks:browser` | PASS | 3/3: way21, reset-day, herbs; локальный `next start` |
| `npm run icons:check` | PASS | 81 glyphs + 7 graphics, preset hand2; после установки Chromium версии lockfile |
| `npm run check:migration-drift` | PASS | Production 101, repo 101, matched 101; дублей версий нет |
| CI `design-gates` для SHA | PASS | [Run 37127232970](https://github.com/po-dzin/centerway/actions/runs/37127232970) |
| CI `admin-smoke` для SHA | PASS | [Run 37127232974](https://github.com/po-dzin/centerway/actions/runs/37127232974); optional steps не следует считать выполненными по одному статусу job |

## Находки по приоритету

### F1 · P1 · Тестовый гейт ломается после 3 октября

`src/lib/landing/formatSync.test.ts:207` формирует `out` с фиксированным
`2026-10-03T12:00:00Z`. В тесте на идемпотентность, строка 250, повторный
`applyFormatSync` вызывается без аргумента даты. Его default — `new Date()`
(`src/lib/landing/formatSync.ts:233`). На 4 октября сравниваются «через 29 днів»
и «через 28 днів». Ошибка повторилась в двух полных прогонах, включая Node 24.
Это дефект теста: изменение countdown при смене календарного дня ожидаемо,
а test проверяет стабильность при якобы одинаковом входе.

Исправление: передавать одну дату в оба вызова либо фиксировать системное
время в этом тесте; затем повторить полный `test:coverage`. Не менять runtime
countdown ради прохождения некорректного сравнения.

### F2 · P1 · Канон и mandatory preflight требуют удалённый runtime генератора

ADR-0004 от 2026-09-11 фиксирует: генератор — dormant spec, его данные и
скриптовые проверки остаются, TypeScript runtime удалён. Фактическая главная
собирается `PlatformHomePage` из typed React blocks:
`src/app/(platform)/page.tsx:15`,
`src/components/platform/PlatformStandalonePages.tsx:19`.

При этом `docs/platform_agent_preflight.md:35`–37 требует три отсутствующих
файла (`canon.ts`, `GeneratedRouteScreen.tsx`, `PlatformGeneratedBlock.tsx`),
а строка 65 заявляет, что публичные страницы рендерятся генератором и что
`PlatformSite.module.css` ещё нужно разделить. Этот CSS уже является коротким
compatibility entrypoint, описывающим выполненное разделение.

Shared «Генератор экранов.md»:16,282,286 также ссылается на удалённое ядро и
называет `GeneratedRouteScreen` основой платформы. Это противоречие активного
канона, accepted ADR и runtime. Зелёные `generator:*`/`guard:semantic` проверяют
сохранённую спецификацию, а не фактическую композицию React главной.

Исправление: согласовать dormant/live boundary в shared canon, registry и
local preflight; связывать правила композиции текущих страниц с проверками
их фактического renderer. Не восстанавливать удалённый генератор ради устаревших ссылок.

### F3 · P1 · Shared migration canon описывает опасный устаревший порядок

«Миграция и SQL.md»:38 и раздел «Оперативный порядок применения» предлагают
SQL Editor первым шагом, а SSoT реестра SQL помещают в `docs/migration/sql/**`.
ADR-0001, AGENTS.md и `docs/migration/README.md` требуют обратного: сначала
committed файл в `supabase/migrations/`, rehearsal, `db:push`, журнал и типы.

Обе инструкции активны и противоречат друг другу. Фактический журнал сейчас
согласован (101/101), поэтому это риск следующей работы, не доказательство
текущей потери миграций. В старом `docs/migration/sql/` ещё есть три SQL-файла;
его существование само по себе не делает папку текущим schema record.

Исправление: привести shared operational note к ADR-0001, отделить историю
переезда от действующего порядка и обновить registry/source_of_truth.

### F4 · P1 · Нет проверки исполнимости и актуальности реестра канона

Из 18 canon notes со `status: active`:

- 10 имеют отсутствующие команды в frontmatter `validated_by`;
- 9 имеют отсутствующие tracked repo paths/globs в `source_of_truth` или `implemented_in`;
- локальные wikilinks в этих заметках разрешаются по именам текущих файлов.

Детальная матрица: `docs/audits/meta-audit-canon-2026-10-04.json`. Сканирование
проверяло текущий frontmatter отдельно от исторических упоминаний команд в
теле, чтобы не считать исторический журнал дефектом текущего гейта.

Примеры: `canon:guard` заменён `guard:canon`; `smoke:admin:governance`,
`smoke:admin:i18n-tone`, `smoke:admin:a11y-contract` стали `guard:admin:*`;
`smoke:admin:ci`, `smoke:landing:qa`, `smoke:dosha:qa` отсутствуют.
Маршруты с route groups (`src/app/(admin)/admin`, `(funnels)`, `(platform)`)
не соответствуют старым paths реестра. У «Боты» отсутствует
`src/lib/reporting/analyticsReports.ts`.

`guard-platform-canon.mjs:155` проверяет существование внешних заметок;
далее проверяет контракт AGENTS/preflight и локальные CSS/data. Он не
валидирует frontmatter, `validated_by` и registry correspondence. В CI
внешний RAverse вообще недоступен и эта часть явно пропускается.

Исправление: локальная производная registry с явной версией/источником и
runnable metadata gate. Наличие внешней папки не должно подменять проверку
содержания, а CI должен явно различать runtime checks и canon verification.

### F5 · P2 · Метаданные реестра расходятся с собственным словарём

«UI-UX канон», «Дизайн-токены» и «Блоки и компоненты» имеют `role: reference`,
которого нет в закрытом словаре «Мета-аудита»; registry обозначает их `canon`.
«Боты» имеет `role: ops`, а строка registry — `ops+contract`, которого нет в
списке разрешённых составных ролей. Тот же `reference` имеет snapshot
«Семиотический паспорт»; это отдельно от 18 active notes.

Исправление: выбрать и согласовать закрытый словарь и роли, затем проверять
совпадение note metadata и registry. Это дефект governance, не runtime.

### F6 · P2 · Воспроизводимость иконок уже восстановлена, gate всё ещё исключён

`scripts/verify-guards.mjs:29`–41 объясняет исключение `icons:check` отсутствием
`ink-rule` в исходнике. На main определение уже есть в
`scripts/lib/icon-glyphs.mjs:785`, проверка проходит: 81 glyphs + 7 graphics.
Общий suite остаётся зелёным, даже если будущая правка рассинхронизирует sprite.

Исправление: убрать устаревшее исключение и вернуть проверку в обязательный
контур. Сначала решить соответствие Script Rule: icon bake использует
Chromium, значит «26 файловых gates без browser» нельзя продолжать описывать
как прежний контракт без изменения dependency/runtime требований CI.

### F7 · P2 · «Текущее состояние» shared architecture/release не соответствует срезу

«Архитектура» описывает отсутствие полной webhook signature verification
и оперативные access tokens как состояние марта; фактический WFP handler
проверяет подпись до записи (`src/app/api/wfp/webhook/route.ts:140`), а
route tests покрывают подделку и повторную доставку. Shared release checklist
пишет, что limiter есть только точечно для Meta; в коде используется общий
`src/lib/api/rateLimit.ts` на публичных событиях, leads, tests и pay routes.
Это не подтверждает наличие лимитера на абсолютно каждом публичном API.

Исправление: исторические snapshots явно пометить, текущую готовность
привязать к точным проверкам. Не превращать старые статусы «Fail/Partial» в
автоматический текущий verdict и не объявлять глобальную безопасность только
по зелёным unit tests.

## Порядок следующего цикла

1. F1: исправить time-dependent test; полный coverage gate должен стать зелёным на текущей дате.
2. F2/F3: согласовать два архитектурных решения с shared canon и local preflight.
3. F4/F5: актуализировать registry и добавить проверку metadata/hooks с прозрачным поведением CI.
4. F6: вернуть проверку иконок в обязательный контур с корректными требованиями к Chromium.
5. F7: обновить текущий release/architecture snapshot по фактическому runtime.

## Границы достоверности

Это метааудит текущего main: enforcement, runtime/document correspondence,
сборка, существующие tests, migration journal и ограниченный browser smoke.
Он не является полным визуальным аудитом всех страниц, penetration test или
проверкой реальных покупок и доставки писем/Telegram. Authenticated platform
browser smoke и admin API smoke с заполненной БД не выполнялись: отдельный
local stack был down. Основной `npm run dev` по локальной конфигурации
указывает на production; для проверки с записью сначала требуется поднять
изолированный stack. Секреты production не подключались к web server.

Migration drift проверяет journal ↔ files по version, не структуру live schema
и не SQL, выполненный вне журнала. У 7 зарегистрированных миграций statements
пусты; это информационный сигнал, их SQL-файлы в репозитории присутствуют.

Новые правила не принимались: результаты оставлены в local operational layer.
Исправления F2/F3 потребуют canon-sync; этот аудит лишь фиксирует разрыв и не
выбирает новую архитектуру вместо владельца проекта.
