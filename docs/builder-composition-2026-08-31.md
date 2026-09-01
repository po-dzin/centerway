# Builder: редактирование и композиция

## Контракт

- Builder: semantic role `method`; вопрос «как изменить этот фрагмент, не потеряв остальной материал?». Источник — существующий typed Course; маршруты Builder/learner не меняются.
- Controls: `selection_family: contour` для полей, модификаторов, меню и раскрытий. Toolbar/picker — quiet boundary; чекбокс — essential; композиция и карточечная коллекция — без декоративной границы. Используется существующий ToastProvider, новых уведомлений/провайдеров нет.
- Guides: role `trust`; вопрос «кто ведёт процесс?». Данные Author с существующим editorial fallback; размеры `--ds-offer-card-*`, материалы/типографика из DS. Переход остаётся в профиль автора.

## Изменения

1. Record title — textarea, body-size, автоматическая высота. Описание и остальные InlineText заполняются до autofocus, не сбрасывают spans при входе в редактуру.
2. Раскрытие настроек — chevron + aria-expanded. Legacy markup pencil удалён из floating toolbar; правый клик полностью оставлен браузеру.
3. List modifier меняет текущий rich-text node, сохраняя другие nodes и форматирование. Quote/code/checklist заменяют его в исходном порядке; соседняя проза остаётся отдельными blocks. Code сохраняет символы и переводы строк, но по своей природе не переносит inline marks.
4. Checklist доступен в desktop/mobile modifiers. Table cells используют тот же inline editor (bold/italic/link). Структурные контролы строк/колонок доступны у выбранной таблицы.
5. `group` — типизированная композиция `children: LessonBlock[]`. Максимум четыре уровня контейнеров. Можно добавить/переставить/удалить подблок, обернуть существующий блок, разобрать группу. Учебные preset-ы собираются в этом же контейнере из семантических подблоков; старые типы и документы не мигрируются автоматически.
6. Вложенность поддержана в validator, readiness, checklist progress, references, renumbering, pruning, portable copy, learner renderer и Markdown/text/DOCX export. Точные group boundaries сохраняет JSON; текстовые экспорты разворачивают их в reading order.
7. Карточки экспертов используют стандартную ширину/высоту карточки курса и горизонтальное media. Полное bio/credentials остаётся в профиле. Один автор больше не растягивается в панораму.

## Данные и rollout

Snapshot Reset Day: title «Розвантажувальний день», posttitle «практикум з умовного голодування» сохранён. Live row имеет приоритет над snapshot: отдельно подготовлена узкая условная SQL-правка, она **не применена**. В ней не перезаписываются другие авторские названия и pending revisions с изменённым title.

`group` хранится в существующем JSONB `lms_lessons.blocks`, новая колонка не требуется. До публикации композиций все readers/writers должны использовать обновлённый validator. Откат к прежнему reader после сохранения group потребует сначала разобрать такие группы.

## Проверка

- Unit: преобразования с bold/link, сохранность соседей, вложенные progress IDs, глубина, pruning, renumbering, export и portable IDs.
- Synthetic UI: `/dev/builder-fixture` только в development (production возвращает 404); нет чтения/записи настоящих курсов. Проверены title/description, list→quote, table bold+italic, добавление вложенного checklist, mobile modifiers. Это не проверка authenticated save/publish.
- Во время работы обнаружены отдельные изменения admin/layout, ToastProvider, AuthorEntry, admin/access: они не относятся к этой правке и не включаются в её scope.

Результат проверки: 39 suites / 370 tests passed; lint, guard:lms-core, TypeScript и production build — pass. Browser: 390px title без горизонтального/вертикального скрытого текста; author cards 304×416 на mobile, 384×464 на desktop 1440px, photo 16:9. Сохранение/публикация реального курса не выполнялись.
