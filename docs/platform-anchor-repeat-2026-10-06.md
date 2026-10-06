# Повторная активация якорных CTA

Локальная правка поведения, без изменения CTA-иерархии, контента, токенов или границ маршрутов. Обновление RAverse не требуется.

## Причина и реализация

Next.js `Link` перехватывал fragment-only переходы. После первого клика и ручного возврата к hero повторная активация того же адреса не прокручивала страницу.

Главная (`#intro-video`), каталоги программ, тестов и продуктов используют нативный `<a>`. Общий `PlatformDetailHero` выбирает `<a>` для `href`, начинающегося с `#`, и сохраняет `Link` для переходов между страницами. Нативное поведение поддерживает повторную активацию мышью и клавиатурой, историю и CSS scroll offsets без клиентского обработчика.

## Preflight / review

| Поверхность | semantic_role | user_question | content_source | token_source | route_boundary | selection_family |
| --- | --- | --- | --- | --- | --- | --- |
| HubHero | orientation | С чего начать знакомство? | Существующий hub.tsx | global-app-ds, heroPrimaryButton | platform `/` | contour |
| Каталоги | route | Как перейти к доступным программам, тестам или продуктам? | Существующий PlatformCatalogPages.tsx | global-app-ds, heroPrimaryButton | platform `/programs`, `/tests`, `/products` | contour |
| PlatformDetailHero | orientation / offer | Как перейти к форматам, плану или результатам программы? | Существующие primaryAction / secondaryAction | global-app-ds, heroPrimaryButton / heroSecondaryButton | текущий platform detail route | contour |

Геометрия границ не меняется. Общий no-selection контракт для контролов сохранён. Новых ink-состояний нет.

## Проверки

- `npm run lint`: без ошибок; существующее предупреждение в PlatformAccountMenu.
- `npm run build`: успешно.
- `npx vitest run src/components/platform/ProgramDetailPage.formats.test.ts`: 7 тестов прошли.
- `tests/e2e/platform-anchor-repeat.spec.ts`: первый клик, возврат наверх с сохранённым hash, повторный клик и Enter на четырёх каталоговых маршрутах; desktop 1440px и mobile 390px.
