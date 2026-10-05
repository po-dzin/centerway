# Общий карандашный материал — 2026-10-05

Источник направления: [разбор видео](references/pencil-style-video-2026-10-05.md). Пользователь запросил аудит существующих вариантов, показ и обновление там, где оно нужно.

## Что найдено и что изменено

| Семейство | До | Результат / применимость |
|---|---|---|
| Общие иконки | 81 baked glyph, равномерная толщина | 82 glyph: добавлен walker, мягкое изменение давления вдоль открытого контура; default hand2 |
| Общие примитивы | ink-stroke, ink-rule, ink-ring, dot, orbit, rail, connector | Все семь пересобраны; счётные dash и точки сохраняют интервалы и роль. ink-rule сохраняет прямую оптическую ось |
| Четыре версии линии | base, hand1, hand2, hand3, только displacement | Единый JSON задаёт displacement и давление. Base — контрольная геометрия; hand1/3 — сравнительные версии; в runtime один hand2 |
| Библиотечная ниша | Повторный проход и равномерные ступени перспективы | Один основной проход, редкие подъёмы карандаша, ограниченная диагональная штриховка задней плоскости |
| Корешки книг | Гладкие SVG edges | Общая непрерывная волна давления и редкая боковая штриховка. Плоскости, таблички, состояния и упаковка книг сохранены |
| Контур внимания библиотеки | Собственная волна веса с шумом каждой точки | Общая pencilPressure, плавный drift; состояние отмечается прежним периметром и подъёмами |
| Название материала в списке | Локальный rowInk / CSS transform | InteractionInkLabel variant=menu; наведённая книга передаёт pointed-state в общий DS, локальный stroke удалён |
| ProgressRing / DoshaWheel | Общий handArc, amplitude 1.1 | Общий meter recipe, amplitude .8; число сегментов, данные и доступность сохранены |
| ProgressRail | Отдельная гладкая фигурка, duplicate jitter | Walker в общем спрайте; общий jitter. Короткий и длинный прогресс сохраняют прежнюю шкалу |
| Компактный профиль | Отдельная гладкая SVG-mask | Icon user из общего набора |
| Платформа / Builder / admin | Один общий sprite | Получают обновлённую геометрию через Icon; admin сохраняет свою серую палитру |
| Сетевые статические лендинги | Копия общего sprite | Копия пересобрана одновременно; URL cache key обновлён. Авторские цвета не заменяются |
| Доша-знаки | Три glyph, разные размеры и tint | Те же формы в общем материале; каталог показывает 32/56/88px и темы |
| Логотип F2, compact, ink/gold, wordmarks, PWA и Telegram-экспорты | Уже заданная геометрия нажима и брендовые производные | Сохраняются: это знак и идентичность, а не ещё одна библиотека иконок. SVG-версии показаны в каталоге |
| Фотографии, видео, официальные знаки сервисов | Контент / узнаваемые сторонние знаки | Сохраняются; карандаш не заменяет доказательства и идентичность сервисов |
| IREM / short и старые прототипы | Авторская продуктовая ветка / исследовательские документы | Не принудительно перекрашиваются в платформу; исторические документы не являются второй runtime-библиотекой |
| Кодовые метки на корешках | Читаемая мелкая метка | Сохраняются без штриховки поверх букв |

## Семантический preflight и review

- Иконки: распознать действие; содержание — существующий registry; token source — cw.tokens.json, параметры линии — cw-pencil.json; route boundary — общий primitive, сохраняет host scope. Сам glyph не определяет selection family: текстовая навигация ink, команды contour, checkbox hybrid по существующим consumers.
- Profile menu: открыть учётную запись; content source — существующий account state; selection_family=contour для trigger, ink для selected menu text; boundary=quiet для menu overlay.
- ProgressRail / круговые meters: понять этап и выполненную долю; content source — прежние числовые props; boundary=none, selection_family неприменим: status, не контроль.
- Library niche / book: найти материал; content source — courses и roomGeometry; route boundary — personal /learn; boundary=none для коллекции, ink для ссылок названий. Attention contour — существующее состояние объекта, не decorative structural frame.
- Читаемый и редактируемый текст сохраняет native selection. Ссылки библиотеки входят в общий no-selection contract для controls.
- Подчёркивание управляется только InteractionInkLabel / globals; локально не масштабируется и не анимируется. Pointed proxy получает те же opacity и clip-path, что hover/focus.

## Источник и сборка

`data/brand/cw-pencil.json` — параметры давления, мягкой неровности и шага дуги. Это рецепт геометрии, а не новая цветовая палитра. Иконки получают заполненную ленту пигмента вокруг прежней оси: внутренние просветы остаются открытыми; closed paths используют even-odd. Семантически залитый bookmark и акцентные точки сохраняются.

Seed давления зависит от имени glyph, а не места в registry: новая иконка не меняет старые. Всё детерминировано. Runtime SVG filters и motion-boil не добавлены.

- `npm run icons:build` — обе shipped-копии и generated name union/cache key.
- `npm run icons:preview -- --out docs/design-system/previews/pencil-2026-10-05` — пять полных листов с четырьмя preset и актуальной token palette.
- `node --import ./scripts/lib/register-ts.mjs scripts/pencil-atlas.mjs` — полный визуальный атлас и сравнение. Замороженные before.svg / before-room.json сохраняют реальные исходники до изменений.

[Каталог](previews/pencil-2026-10-05/index.html), [весь набор](previews/pencil-2026-10-05/all.png), [до / после](previews/pencil-2026-10-05/comparison.png).

## Проверка

icons:check — 82 + 7, без drift. DS contract, motion, pointer, contrast — pass. 50 тестов pencil pressure, interactionLayering, surfaceBoundaries и roomGeometry — pass. ESLint — без ошибок, остаётся прежнее предупреждение window.location.assign в account menu.

Первый build: компиляция успешна; typecheck заблокирован устаревшим .next-dev/dev/types со ссылками на пять удалённых routes. Кэш перемещён в /tmp/cw-next-dev-types-20261005-pencil, исходники маршрутов не менялись. Повторный typecheck — pass. Повторный build — pass (exit 0), включая TypeScript и генерацию 102 страниц.

Gzip sprite: 73 324 → 156 922 bytes (82 glyph + 7 primitives). Размер общего sprite увеличивается из-за двух краёв каждого pressure ribbon; это цена baked-геометрии, не runtime-фильтр. Локальный каталог проверяется отдельно от персональной библиотеки: показ SVG-сцены не подтверждает доступ к authenticated /learn и её данные.
