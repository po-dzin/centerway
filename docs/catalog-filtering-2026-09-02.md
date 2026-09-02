# Каталог: поиск, фильтры и интервал цены (2026-09-02)

Локальная имплементационная запись. Канон не менялся — реализованное правило
уже записано в `Блоки и компоненты.md` → `Marketplace Aggregate Catalogue
contract`: «Категории могут сужать этот каталог через компактные фильтры, но не
дробят полный набор на последовательные карусели» и «Нулевая цена является
отдельным бесплатным состоянием и не равна отсутствующей цене».

## Preflight

| поле | значение |
| --- | --- |
| surface | platform hub (`/`), aggregate catalogue (`/programs`), product aggregate (`/products`) |
| semantic_role | offer / route |
| user_question | «что здесь вообще есть и какой вариант мне подходит?» + «что можно взять, ничего не потратив?» |
| token_source | global app DS delivery tokens; рецепты контролов composed из `PlatformButtons.module.css` и `cabinet/ShelfFilter.module.css` |
| content_source | database (`lms_courses` + `lms_course_offers` через `listStorefrontCourses`), `content.ts` для продуктов |
| route_boundary | platform routes; воронки не затронуты |
| selection_family | `contour` — поле поиска и кнопка-раскрытие; `hybrid` — строки опций (системный чекбокс + `InteractionInkLabel variant="menu"` по ширине слова) |
| boundary role | quiet (labelled command / search / popover), essential — только чекбоксы |

## Что сделано

**Движок отдельно от контрола.** `src/lib/platform/catalogQuery.ts` — чистый
модуль: тип запроса (`text`, `categories`, `kinds`, `price`, `freeOnly`),
предикат `matchesCatalogQuery`, `filterCatalog`, `catalogFacets` и URL-кодек
(`readCatalogQuery` / `writeCatalogQuery`). Новая ось = поле в `CatalogItem`,
поле в `CatalogQuery`, одно условие в предикате, одна фасета и одна пара ключей
в кодеке. Тесты: `catalogQuery.test.ts` (11).

**Три коммерческих состояния остаются тремя.** `amount: number | null`, где
`null` — «ціна за запитом». Интервал и переключатель «тільки безкоштовні»
исключают `null`: у непрощённой цены нет фигуры для сравнения. Нулевая цена —
отдельное состояние, а не «дёшево».

**Карточка печатает слова, движок сравнивает коды.** `StorefrontCard` получил
`amount`, `currency` и `kind` (код) рядом с уже существовавшими `price`
(отформатированная строка) и `kindBadge` (слово). Словарь кодов вынесен в
`src/lib/platform/catalogVocabulary.ts` — один источник для карточки (сервер) и
для фильтра (клиент), без затягивания серверных импортов в бандл.

**Контрол переиспользует полку, а не копирует её.**
`PlatformCatalogFilter.module.css` composes `find` / `filterToggle` /
`filterCount` / `filterPopover` / `filterOption` / `filterCheckbox` из
`cabinet/ShelfFilter.module.css`. Своё — только группы внутри поповера и
числовой интервал (`.band*`). Регрессионные контракты расширены:
`interactionLayering.test.ts` (ink-вариант на всех трёх группах + composes),
`surfaceBoundaries.test.ts` (`.bandField` — quiet contour, не control stroke).

**Каталог остаётся одним непрерывным набором.** `PlatformCatalogBrowser` только
убирает карточки из существующей сетки `aggregateRail`: не сортирует, не
разбивает на карусели, не подменяет лентой. Состояние живёт в клиенте (ответ на
нажатие клавиши), адрес пишется через `replaceState` и читается обратно в
эффекте после монтирования — сервер рендерит несуженный каталог, поэтому
гидрация совпадает.

**Контрол не показывается, когда за ним ничего нет.** Меньше двух карточек —
сетка без фильтра; одна категория/один формат — группа не предлагается; ничего
не оценено — нет интервала. Поэтому `/products` с одним продуктом выглядит ровно
как раньше и получит поиск и цену в день появления второго.

**Главная: блок бесплатных материалов** (`HubFree`) после `HubPrograms`,
`commercialMode === "free"`, встроенная подборка через `PlatformOfferCarousel`
(carousel-контракт), ссылка «Усі безкоштовні» → `/programs?free=1`. При пустом
наборе блок не рендерится: заголовок над дырой хуже отсутствия секции.

## Проверено

- `catalogQuery.test.ts` — 11 тестов; `src/lib/platform`, `src/components/platform`,
  `src/lib/lms`, `src/lms-core` — 470 тестов зелёные.
- dev: `/`, `/programs`, `/products` → 200. `?free=1` сужает 6 → 1;
  `max=1000` → 2; `/programs?kind=mini&max=2000` читается из адреса при загрузке
  (счётчик «Фільтри 2», показано 1 из 6). Блок `#free-materials` стоит между
  `#programs` и `#stories`.
- `npm run lint` — чисто.
- `npm run guard:buttons` — падает на `.queueDotButton` в
  `PlatformOfferCarousel.module.css`. Это НЕ из этой работы: файл изменён
  параллельной сессией в том же дереве, при `git stash` гейт зелёный.

## Не сделано намеренно

`/products` не получил полный фильтруемый агрегатор курсов: полный
сравниваемый каталог принадлежит основной странице сущности, а встроенная
подборка «Пов'язані програми» остаётся каруселью по контракту. Фильтр там
подключён к собственному ряду продуктов и включится сам, когда продуктов станет
больше одного.
