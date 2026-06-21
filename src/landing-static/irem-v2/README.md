# irem-v2 — alt/A-B лендинг ІВЕМ

Самодостаточный статический лендинг (всё инлайн: CSS-токены, разметка, `js/common.js`).
Альтернативная версия `/irem` для A/B. Живёт на `centerway.vercel.app/irem-v2`.

## Как отдаётся (routing)

Аддитивно, **без изменения `/irem`**:

- `src/app/irem-v2/route.ts` — отдаёт `index.html` на чистом URL `/irem-v2`
  (route handler, а не page: страница везёт свой `<html>/<head>/<base>`, её нельзя
  оборачивать в layout платформы).
- `LANDING_STATIC_BRANDS` в `src/lib/landing/contracts.ts` содержит `"irem-v2"` →
  catch-all `src/app/[brand]/[...path]/route.ts` отдаёт сырые ассеты
  `/irem-v2/img`, `/irem-v2/js`, `/irem-v2/fonts` через `serveStaticAsset`.
- `irem-v2` НЕ является `StaticLandingProduct` (short/irem), поэтому НЕ проходит
  через `prepareLandingHtml` (инъекция офферов, shared-CSS) — и это намеренно.

`<base href="/irem-v2/">` в `<head>` делает все относительные ассеты абсолютными от
этого пути. Если меняется URL развёртывания — обновить `base href`.

## Токены / DS

Локальные токены объявлены под скоупом `[data-cw-landing="irem"]` (тот же механизм,
что у общего `landing.bridge.css`), не текут в глобальный `:root`, не конфликтуют с
`--cw-*` / `--ds-*`. Декоративные — под префиксом `--irem-*`.

## Зависимость от `/irem` (в одну сторону)

irem-v2 ссылается на старый лендинг — он должен оставаться опубликованным:

- кнопка покупки: `href="/irem"` — no-JS фоллбэк
- политика: `/irem/index2.html`

Покупка через `.openModal` → `js/common.js` → `/api/pay/start?product=irem&offer_id=irem_main_4100&value=4100&currency=UAH&...`
(эндпоинт общий с `/irem`, от домена origin; `base href` его не ломает).

## TODO перед запуском в реальную воронку (ad traffic)

- [ ] **FB Pixel + Clarity.** Сейчас НЕ подключены. В старом `/irem` в `<head>` есть
      инлайновый `fbq('init','885125430564169')` + Advanced Matching + Clarity
      (`vy9u7jygno`). `common.js` работает без них (server-side события `/api/events`
      шлются всё равно), но браузерный Pixel/Purchase и матчинг для рекламы
      потеряются. Перенести head-блок из `src/landing-static/irem/index.html`.
- [ ] **Подтвердить `/reboot`** как целевой роут Short-блока (ссылка `Почати з Short`).
      Сейчас стоит `/reboot` (по smoke-картам short↔reboot).
- [ ] **Проверить на проде** реальный редирект `/api/pay/start` (на статике 404 —
      эндпоинт только на бэке).
- [ ] **OG-теги / og:image** для шеринга (сейчас только title/description).
- [ ] Уже сделано: `robots: noindex,nofollow` + `canonical → /irem` (чтобы alt-версия
      не конкурировала за индексацию). При промоушене в основную — снять noindex.

## Локальный preview

Из-за `base href="/irem-v2/"` отдача с корня (`python -m http.server` на 4178)
ломает ассеты. Проверять через Next-роут (`/irem-v2`) либо отдавать под подпутём
`/irem-v2/`.
