# Проверка повторных якорей на лендингах

Проверяется текущий локальный runtime: `/reboot`, `/reboot-b`, `/irem`, `/way21`, `/reset-day`, `/consult/index.html`, `/herbs`, `/dosha/index.html`. Consultation и dosha открываются через статические entry URL, чтобы проверить воронку, а не платформенную страницу.

## Контракт и находка

Лендинги используют нативные anchors / `data-scroll-to` и вызывают прокрутку при каждой активации. Повтор уже установленного hash сам по себе не блокирует обработчик. `landing-runtime.js` выполняет повторный instant-scroll для Short/IREM; статические воронки используют собственные обработчики.

Найдена отдельная ошибка доставки: конфигурация Next-shell запрашивала `/short/js/common.js` и `/irem/js/common.js`, которые отсутствуют. Статические документы уже подключают `/shared/js/funnel-common.js`. Теперь shell использует тот же существующий shared-файл. Тест `src/lib/landing/config.test.ts` проверяет наличие всех подключаемых scripts обоих managed products.

Preflight: поверхность product funnel; semantic_role текущих hero — orientation/offer; вопрос — «как перейти к формату или следующему шагу?»; content_source — существующий landing; token_source — существующие generated/global DS bundles; route_boundary — isolated funnel. CTA selection_family=contour, navigation selection_family=ink. Компоненты, тексты, границы, токены и графика ink не изменены. Это локальная доставка существующего контракта; обновление RAverse не требуется.

## Browser regression

`tests/e2e/landing-anchor-repeat.spec.ts` проверяет hero scroll CTA и FAQ-навигацию: повторные клики и Enter после возврата к начальной позиции при уже установленном hash. Desktop 1440px и mobile 390px, включая раскрытие мобильного меню. Herbs проверяется через навигацию: его коммерческая кнопка может запускать checkout. У dosha hero ведёт на тест, поэтому проверяется якорная навигация.

Тест ждёт готовности шрифтов до навигации и проверяет, что секция оказывается на вычисленном CSS `scroll-margin`, включая коррекцию после шрифтов. На managed pages ожидает `data-cw-nav-ready="1"`.

Проверка ведётся на локальной production-сборке. Dev-сервер на 8000 в этой сессии не инициализировал managed runtime; независимая production-сборка инициализирует его и проходит повторную активацию. Production на внешнем домене в рамках этой проверки не проверяется и не публикуется.

Итог: 16 browser-сценариев прошли (8 лендингов × 2 viewport), 2 теста доставки scripts прошли, `npm run build` и `smoke:landing:next-contract` прошли. `npm run lint` — без ошибок, с существующим предупреждением PlatformAccountMenu. Форматирование изменённых файлов проверено.
