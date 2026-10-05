# Закрытие метааудита — 2026-10-05

Рабочая ветка: `codex/meta-audit-remediation-20261005`, основа `016b5a34`
(актуальный origin/main при повторном fetch 2026-10-05). Решения закрывают
F1–F7 из `meta-audit-platform-2026-10-04.md`.

## Изменения

- F1: тест идемпотентности format sync получает один фиксированный `now` в обоих проходах. Runtime countdown не меняется.
- F2: local preflight и README описывают typed React/static landing runtime; generator data и semantic gates проверяют dormant spec по ADR-0004.
- F3: shared migration operations согласуются с ADR-0001: файл и локальный commit до применения, rehearsal, session pooler push, journal, generated types, drift check.
- F4/F5: `docs:canon:sync` строит `data/canon/registry.snapshot.json` из метаданных и registry rows RAverse. `guard:canon-metadata` проверяет роли, ссылки, paths, npm hooks, полноту active rows и correspondence. При доступном RAverse сверяет полный source hash и projection; без него честно печатает snapshot-only. Словарь ролей согласован с governance, business audit и mini-network plan включены в registry.
- F6: `verify:icons` включён в `verify:ds` и в design CI отдельным шагом после Chromium install. File-only `verify:guards` не получает скрытую browser dependency.
- F7: shared architecture/release notes имеют текущую границу доказательств: signature gate, TS authorization, defence-in-depth RLS, limiter scope, optional smoke и snapshot-only CI. Старые апрельские tables/backlog сохранены и помечены историческими.

## Shared canon и производная

RAverse остаётся SSoT; JSON хранит метаданные и полные source hashes, не копию
всего канона. `docs/audits/shared-canon-remediation-2026-10-05.patch` фиксирует
reviewable изменения внешних файлов; namespace paths в patch относятся к
RAverse, не к дереву этого repo. Source bytes проверяются перед записью, чтобы
не затереть изменения другой сессии. Временные оригиналы сохранены отдельно.

После правки shared notes: `npm run docs:canon:sync`. Без живого источника sync
отказывается работать. В CI committed snapshot валидируется, но freshness
внешнего source не утверждается. Исторические `legacy_source` breadcrumbs
проверяются на namespace/path safety без требования существования старого
файла; они не являются runtime dependency.

Parser поддерживает явный scalar/list frontmatter-контракт и отвергает
неподдерживаемый YAML; сложная YAML-семантика не угадывается. Внутренние wiki
links проверяются до note target, не до anchor. Содержательное совпадение
правила и кода остаётся задачей review: metadata PASS не заменяет UI/security
проверку.

## Проверка

На Node 24.19.0:

- `lint`: PASS, один существующий warning в `PlatformAccountMenu.tsx:287`, вне изменённой области.
- `typecheck`: PASS.
- `build`: PASS; сборка без production secrets, data-backed страницы используют предусмотренный fallback.
- `test:coverage -- --maxWorkers=4`: 198 файлов, 1983/1983 теста; statements 32.82%, branches 30.03%, functions 30.67%, lines 33.35%. Coverage ratchet поднят до 32/30/30/33 по правилу округления вниз.
- `guard:canon-metadata-rules`: чистые, snapshot, bootstrap и provenance fixtures плюс 35 отрицательных случаев (в том числе неверный role/path/hook, registry mismatch, дубликаты, source hash drift и malformed data).
- Live canon/snapshot correspondence: PASS, 19 заметок и 19 строк; отдельный запуск без source: PASS с явным snapshot-only.
- `verify:icons`: PASS, 81 glyphs + 7 graphics.

Первый полный тестовый запуск при автоматическом числе workers встретил три
15-секундных cold-import timeout в двух неизменённых suites. Все 40 тестов
этих suites и format-sync прошли отдельно, затем два полных coverage прогона
с четырьмя workers прошли. Таймауты и конфигурация workers не ослаблялись.

Финальный `verify:guards`: PASS, 28 gates. Локальный `smoke:thanks:browser`: PASS, 3/3 сценария (way21, reset-day, herbs). Все F1–F7 закрыты в пределах этого плана; внешний deployment и authenticated production smoke не входят в этот цикл.

## Границы цикла

UI, платёжная логика и БД не изменялись; UI semantic-role/selection-family
preflight неприменим. Никаких migration apply, публикаций, PR и deployments.
Изменения сделаны в checkout аудита, отдельно от незакоммиченной creator
admission и остальных файлов основного дерева.
