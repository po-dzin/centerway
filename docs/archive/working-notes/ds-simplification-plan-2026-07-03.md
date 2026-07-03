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

### Этап 2 — Один словарь «semantic» ✅ применён 2026-07-03

Поправка при верификации: `semantic_family` (block_manifests) и `family` (semantic_block_layer) оказались **согласованы по всем 33 блокам** — «третий словарь» из аудита не подтвердился. Реальных осей две с половиной: content role (`semantic_role`), block family (`semantic_family`/`family`, единый набор), visual tone (`primary_semantic`/`semantic_tags`/`token_recipes` = словарь `--cw-sem-*`). Переименование полей в данных не понадобилось — вместо churn'а зафиксирована таблица осей.

1. Создан живой `docs/design-system.md`: таблица трёх осей + per-block mapping (12 типов блоков), карта токен-префиксов (source → consumers → guard), границы покрытия контрактного слоя, aspirational ledger, validation stack.
2. Архивные `design-system-spec-2026-05-17.md` и `design-system-brandbook-extract-2026-06-27.md` получили superseded-баннеры; `docs/LOCAL_DOCS.md` включает новый док в active root set.

### Этап 3 — Сжать слои до трёх ✅ применён 2026-07-03

Поправка при верификации: `--cw-color-*` имел **ноль потребителей** в компонентах (единственные ссылки — внутри самого `globals.css`), поэтому «депрекация с миграцией потребителей» превратилась в чистое удаление слоя.

1. Слой `appAlias` (`--cw-color-*`, 13×2 токенов) удалён из `cw.tokens.json` и `globals.css`. Заведён честный `--cw-sem-trust: #35535f` (значение — исторический trust-цвет из landingBase) вместо `--cw-color-trust-info: var(--cw-status-running)`.
2. Дедупликация выполнена в пользу кодогена: рукописный «Platform DS contract» блок (light, 70 токенов — включая type/button/offer-card шкалы) перенесён в `delivery.dsAlias.light`; рукописный dark-контракт (полный дубль `DS_ALIAS_DARK`) удалён; мёртвые рукописные копии `sem/depth/platform/glass/shell` в `:root` (затенённые `CW_RUNTIME`) удалены. `--ds-radius-button-soft` остался в base (button shape contract).
3. Кодоген владеет базовым брендовым слоем: `:root`/`.dark` app-chrome токены (98 light + 82 dark) перенесены в `cw.tokens.json → base.light/base.dark`, эмитятся через маркеры `CW_BASE_LIGHT/DARK`. Рукописными в `@layer base` остались только `--cw-platform-visual-*` градиенты. «Тема = данные» теперь верно для всей поверхности токенов. Материализация как generator-pack НЕ сделана осознанно: пак в `data/generator/token_packs.json` попал бы в `themeCatalog` как тема генератора — вместо этого `base` живёт в `cw.tokens.json`; активация pack-механизма на автора — при появлении второй реальной темы. Сущность `author` не вводится (решение 2026-06-20 в силе).

Верификация эквивалентности: last-wins карта токенов `:root`/`.dark` против HEAD — удалены ровно 13 мёртвых `--cw-color-*` на селектор, добавлен `--cw-sem-trust`, два косметических эквивалента (кавычки font-family; `--cw-card-border` → напрямую `var(--cw-border)`). Полный гейт-сет + build зелёные.

### Этап 4 — Guards под новую структуру ✅ применён 2026-07-03

1. `guard-ds-contract.mjs` расширен на семантический слой: required-floor `--cw-sem-*`/`--cw-platform-*` (18 токенов) на `globals.css`; `assertNoRepoPattern` запрещает реинтродукцию удалённого `--cw-color-*`. Raw-hex в компонентах **не дублируем** — уже покрыто canon:guard по `src/components/platform` (плюс запрет локальных `--cw-*` определений).
2. Новый `scripts/guard-contrast.mjs` + `guard:contrast` в `ds:qa`: резолвит `var()`/`color-mix(in srgb,…)` из `cw.tokens.json` и проверяет WCAG на реальных парах text-on-surface. Порог: body/heading ≥ 4.5, CTA-заливки (крупный/полужирный лейбл) ≥ 3.0. Token-packs **не** покрываем — у них ноль потребителей (этап 3.3 отложен); добавить пары при активации первого пака.
   - **Зафиксированный факт:** две CTA-заливки ниже body-AA — `accent-contrast` на `guide-primary` (4.34) и на `boundary` (4.17). Проходят large-tier 3.0, но это первые кандидаты на подтюнинг палитры. Оформлено явно, не занижением планки.
3. Обратная route-проверка: считаем существенно закрытой этапом 0 (alias-инварианты в `semantic-audit.mjs` теперь падают через existsSync-fail, а не ENOENT). Полную проверку «каждый contract `route_path` существует в `src/app`» **не** вводим — funnel-entry пути внутренние для генератора, не файловые роуты; такой чек давал бы ложные фейлы.

Гейт-сет после этапа 4: `canon:guard` · `tokens:check` · `guard:ds-contract` · `guard:contrast` · `generator:validate` · `semantic:audit` · lint · build — все зелёные.

## 3. Что осознанно НЕ делаем

- Не расширяем route-контракты на всю платформу (`/programs/*`, дашборд) — потребитель появится с LMS. В доке фиксируем границу: «контрактный слой покрывает generated funnel surfaces».
- Не вводим `author` в данные (решение 2026-06-20).
- Не трогаем изоляцию Short/IREM CSS.
- Не удаляем dark-тему — она рабочая для админки (поправка №1 выше). При этом public-платформа dark не имеет — это ок и не является долгом.

## 4. Триггер синхронизации канона ✅ частично применён 2026-07-03

Анализ показал: бóльшая часть этапов 0–4 **исполняет** канон, а не меняет его (легаси-мост канон и так запрещал; `trust` и `organic` — канонические роли; 8-слойная модель канона = намерение, 3-слойная доставка = материализация, не конфликт). Поэтому синхронизация — узкая.

**Применено к `RAverse/ReOS/Projects/CenterWay/Дизайн-токены.md`** (стор не под git; сделан бэкап `.Дизайн-токены.md.bak-20260703`):
1. `validated_by` += `tokens:check; guard:contrast`.
2. Чеклист «UX-целостность» — зафиксирован enforcement контраста (`guard:contrast`, WCAG body ≥ 4.5 / large-CTA ≥ 3.0; две слабые CTA-заливки помечены).
3. «Runtime Token Serialization» — запись об удалении легаси `--cw-color-*` bridge и codegen-владении base/delivery.

**НЕ поднято (отложено):** правило «территория автора = token pack». Token packs имеют ноль потребителей, активация (этап 3.3) и мульти-авторская модель в данных отложены до LMS (решение 2026-06-20). Подъём сейчас был бы спекулятивным. Вернуться при активации первого пака на автора.
