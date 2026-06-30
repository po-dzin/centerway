# Static Funnel Network Cutover — 2026-06-29

## Scope

- Funnel family `way21 / reset-day / dosha / herbs / consult` переведена на static-first слой в `src/landing-static/**`.
- `short` и `irem` не входят в эту сеть и остались изолированной парой.
- `generator` и `components/landing` удалены из active app runtime.

## Canonical hosts

- `way21.centerway.net.ua`
- `resetday.centerway.net.ua`
- `dosha.centerway.net.ua`
- `herbs.centerway.net.ua`
- `consult.centerway.net.ua`

## Redirect policy

- Все `www.*` funnel hosts должны 308 редиректить на bare host.
- `detox.centerway.net.ua` и `www.detox.centerway.net.ua` считаются retired aliases и 308 редиректят на `https://way21.centerway.net.ua/`.
- Legacy path aliases `detox` и `mini-detox` в request-brand resolution больше не являются canonical product decisions:
  - `detox` -> `way21`
  - `mini-detox` -> `reset-day`

## Runtime contract

- Host root для новых funnels теперь переписывается в static assets `/{brand}/index.html`.
- `dosha` host дополнительно пропускает `/dosha-test` в существующую platform surface, чтобы не ломать текущий API/result flow.
- `consult`, `herbs` и `dosha` получили новые static entry documents:
  - `src/landing-static/consult/index.html`
  - `src/landing-static/herbs/index.html`
  - `src/landing-static/dosha/index.html`

## Shared assets and styles

- Общий visual shell вынесен в:
  - `src/landing-static/shared/css/funnel-network.css`
  - `src/landing-static/shared/js/funnel-network.js`
- Shared portrait asset перемещён в:
  - `src/landing-static/shared/img/consult-hero-evgeniy.jpeg`

## Folder cleanup

- Удалены active runtime paths:
  - `src/app/(platform)/funnel-entry/**`
  - `src/app/(platform)/funnel-support/**`
  - `src/app/(platform)/lesson/pilot/**`
  - `src/components/generator/**`
  - `src/components/landing/**`
  - `src/landing-static/cw/**`
- Удалены legacy CSS remnants:
  - `src/landing-static/consult/css/**`
  - `src/landing-static/herbs/css/**`

## Known exceptions

- `src/lib/generator/**` и `data/generator/**` пока не удалены целиком, потому что часть platform/internal support code всё ещё использует generator-level types and theme helpers.
- Platform `/dosha-test` сохранён отдельно и остаётся richer product surface поверх того же тестового движка.
