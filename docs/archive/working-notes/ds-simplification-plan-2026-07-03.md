# План упрощения семантической дизайн-системы CenterWay

- Дата: 2026-07-03
- Статус: local operational plan (docs-first); этапы 0–1 применены в этой же ветке
- База: мета-аудит ДС от 2026-07-03 (сессионный, поверх `docs/archive/working-notes/meta-audit-ecosystem-2026-06-20.md`, слой L3)
- Гейты на момент среза: `canon:guard` PASS · `guard:ds-contract` PASS · **`semantic:audit` CRASH (ENOENT)** — см. этап 0

---

## 0. Поправки к аудиту (проверено по коду перед применением)

Два утверждения первичного аудита не подтвердились при верификации — фиксируем, чтобы не тащить ошибку дальше:

1. **Dark-тема НЕ фикция.** Dark-блок в `globals.css` живёт под селектором `.dark` (не в том же `:root`), а `src/components/ThemeSwitcher.tsx` переключает `document.documentElement.classList` и подключён в `src/app/(platform)/admin/layout.tsx`. Dark — рабочая тема **админки**. Каскадного конфликта light/dark нет. Реальная (меньшая) проблема: внутри каждого из `:root`/`.dark` сгенерированный `DS_ALIAS_*` блок и рукописный «Platform DS contract» блок объявляют одни и те же `--ds-color-*` имена дважды — дублирование одинаковых значений, не поломка. Разруливается на этапе 3.
2. **`landingBrandOverrides` — не «неразличённый copy-paste», а целиком мёртвые данные.** Секции `landingBase` и `landingBrandOverrides` в `cw.tokens.json` не имеют ни одного потребителя: `generate-design-tokens.mjs` читает только `appAlias`, `layers`, `delivery.dsAlias`; лендинги берут токены из `src/landing-static/shared/css/tokens.css` (рукописный файл). Единственный побочный эффект — hex-значения из JSON попадают в hex-allowlist `guard-platform-canon.mjs`.

Подтверждённые находки аудита (остаются в силе):

- `semantic-audit.mjs` падает необработанным ENOENT: проверяет `src/app/(platform)/funnel-support/[product]/[page]/page.tsx`, удалённый в `ed7a9fc` (миграция на static architecture). `ds:qa` целиком не проходит.
- Класс багов «кодоген молча откатывает ручную правку» (см. `e0c7dbc`, touch-target 3rem→2.75rem) не закрыт инвариантом в CI.
- Три таксономии под словом «semantic»: визуальные роли токенов (`calm/guide/trust/...`), IA-роли блоков (`orientation/offer/proof/...` в `block_manifests.json`), и `family`-имена `semantic_block_layer.json` (`offer_route`, `boundary_caution`) — не совпадающие между собой.
- Из 8 заявленных ролей спеки токенами реализовано 6; `organic` отсутствует, `trust` — легаси-алиас `--cw-color-trust-info: var(--cw-status-running)`.
- 7 brand modes спеки (`sanctuary/guide/method/proof/practice/progress/community`) не существуют в рантайме ни в каком виде.
- `token_packs.json` (3 theme families, полный набор) подключён в `themeCatalog.ts`, но `--cw-role-*`/`--cw-cta-*` токены не потребляются ни одним компонентом.
- Route-контрактный слой покрывает 5 экранов (funnel-entry consult/detox/herbs + lesson pilot), не платформу целиком.
- Контраст (WCAG) не проверяется ни одним guard-скриптом.

---

## 1. Целевая картина

Сейчас — 5+ параллельных токен-префиксов и 3 словаря «semantic». Цель — три слоя и один словарь:

```
1. SOURCE    token_packs.json (тема = автор/бренд)   ← единственный механизм тематизации
2. SEMANTIC  --cw-sem-* + --cw-platform-*            ← единственный словарь визуальных ролей
3. DELIVERY  --ds-* (компоненты потребляют только его)
```

- Легаси `--cw-color-*` — на депрекацию.
- `--landing-*`/`--product-*`/irem `--color-*` остаются только внутри изолированных лендингов — это граница авторов ([[centerway-multi-author-hub]]), не бардак; не трогаем.
- Плоский CSS на выходе кодогена — осознанное решение: слоение живёт в JSON-сорсе и доке, не в рантайме.

## 2. Этапы

Порядок жёсткий; после каждого этапа `ds:qa` зелёный. Можно остановиться после любого.

### Этап 0 — Гейты говорят правду ✅ применён 2026-07-03

1. `semantic-audit.mjs`: убрать мёртвую проверку `funnel-support`; чтения файлов-инвариантов обёрнуты в existsSync с внятным fail вместо необработанного ENOENT.
2. Новый инвариант `tokens:check`: `tokens:build` обязан быть no-op на чистом дереве (`git diff --exit-code -- src/app/globals.css` после прогона). Включён в `ds:qa`. Закрывает класс багов `e0c7dbc` навсегда.

### Этап 1 — Удалить мёртвое ✅ применён 2026-07-03

1. Удалены `landingBase` и `landingBrandOverrides` из `cw.tokens.json` (ноль потребителей; проверено гейтами после удаления). Если hex из этих секций требовался allowlist'у canon:guard — значение добавляется в живой токен-источник, а не в мёртвую секцию.
2. Спека `design-system-spec-2026-05-17.md` получает пометку о нереализованных сущностях (7 brand modes, роль `organic`) — блок «Aspirational, not implemented». Спека описывает то, что есть.

### Этап 2 — Один словарь «semantic» (≈1 день)

1. Развести имена по осям: визуальный тон = «semantic role» (токены `--cw-sem-*`); роль контента в манифестах → `content_role` (или таблица соответствия при сохранении имени); `semantic_family` vs `family` привести к одному набору значений.
2. Одна таблица соответствия `content_role → визуальные semantic-токены → блоки-потребители` в живом доке ДС.
3. Слить `design-system-spec-2026-05-17.md` + `design-system-brandbook-extract-2026-06-27.md` в один живой `docs/design-system.md` (вне archive); старые — заглушки-указатели.

### Этап 3 — Сжать слои до трёх (2–3 дня)

1. Депрекация `--cw-color-*`: потребители переводятся на `--ds-*`/`--cw-sem-*`; guard запрещает новые потребления. Завести честный `--cw-sem-trust` вместо `--cw-color-trust-info: var(--cw-status-running)`.
2. Дедупликация `DS_ALIAS_*` vs рукописного «Platform DS contract» в `globals.css`: одни и те же `--ds-*` имена не должны объявляться дважды в одном селекторе; победить должен один источник (кодоген), рукописный блок сокращается до токенов, которых нет в JSON.
3. `token_packs.json` — официальный единственный механизм тем: platform-тема материализуется как pack (текущий `:root` ≈ `token_pack.living-mineral.v1`), кодоген собирает `:root` из пака. Автор №3 = новый pack + маршрутизация, ноль новых механизмов. Сущность `author` в данные НЕ вводится (решение 2026-06-20 в силе — до LMS); pack привязан к поверхности/бренду как `hostBrand`.

### Этап 4 — Guards под новую структуру (≈1 день)

1. Расширить `guard-ds-contract.mjs` на семантический слой: required-список `--cw-sem-*`/`--cw-platform-*`; запрет потребления `--cw-color-*` вне легаси-allowlist; запрет raw hex в `src/components/**` (сейчас это делает только canon:guard по platform CSS).
2. Контраст-чек WCAG AA на пары text/bg из `cw.tokens.json` + token packs; в `ds:qa`.
3. В `semantic-audit.mjs` — обратная проверка «каждый физический route-инвариант существует в `src/app`», чтобы рефакторинги роутов больше не оставляли мёртвых проверок (частично закрыто на этапе 0 через existsSync-fail).

## 3. Что осознанно НЕ делаем

- Не расширяем route-контракты на всю платформу (`/programs/*`, дашборд) — потребитель появится с LMS. В доке фиксируем границу: «контрактный слой покрывает generated funnel surfaces».
- Не вводим `author` в данные (решение 2026-06-20).
- Не трогаем изоляцию Short/IREM CSS.
- Не удаляем dark-тему — она рабочая для админки (поправка №1 выше). При этом public-платформа dark не имеет — это ок и не является долгом.

## 4. Триггер синхронизации канона

После этапа 3 (token packs как механизм тем на автора/бренд) — поднять правило в `RAverse/ReOS/Projects/CenterWay/Дизайн-токены.md`: «визуальная территория автора = token pack; кросс-потребление слоёв запрещено guard'ом». До этого — всё local.
