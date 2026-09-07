# Change journal: the three kinds that make history evidence

## What was already true

`lms_course_revisions` has existed since 2026-08-23, with an append-only grant
(`service_role` holds `SELECT, INSERT` and nothing else) and five declared
checkpoint kinds. Exactly one of them — `manual` — was ever written.

That is not an oversight; it is the operational order
`docs/lms-course-version-history-2026-08-23.md` set out on purpose:

> Restore, review and publish checkpoints stay disabled until their document
> mutation and journal insert share one transaction. A two-request or
> save-then-log implementation is forbidden because it can report failure after
> the document has already changed.

The transaction did not exist, so the kinds stayed off. What shipped was an
author convenience — snapshots an author chose to keep — and not a journal.

## The gap this closes

The review gate left **no artifact**. `pending_content` holds the document under
review and is nulled the moment an admin approves; `audit_log` records the ACT
of approving without the thing approved. So "the author passed review and then
rewrote the boundary block" could be neither demonstrated nor ruled out — the
question had no evidence on either side.

Three kinds now write, and each answers a question that previously had no answer:

| Kind | Pins |
| --- | --- |
| `review_submitted` | the exact document sent to moderation |
| `published` | the exact document projected to learner rows |
| `restored` | that a rollback happened, and which revision it came from |

`autosave_checkpoint` writes too, in a second pass the same day — see below.

## The transaction, and why the mapping is not in SQL

`apply_lms_course_release` commits the relational projection and the revision
insert together. It is a **dumb transactional applier**: TypeScript still owns
the JSON ⇄ row mapping (`courseRows`), the readiness gate and the preserve/
authoritative decision (`prepareCourseWrite`), and the deletion guards
(`planRemovedRows`). Re-stating the column list in PL/pgSQL would create a second
owner of that mapping which drifts silently the first time a course column is
added — so the function derives its column lists from the catalog at run time
and never names them.

This also closes an older gap `authoring.ts` had documented and could not fix:
on the approval path a module or lesson upsert failing partway used to leave the
course half-written with the approval already recorded.

`writeCourseStructure` is unchanged in behaviour and remains the shared write
path for the builder, `lms:seed` and `lms:import`. The invariant that the builder
cannot publish what the seed would reject is untouched: the release path runs the
same preparation rather than a copy of it.

## Restore is not a rewind

Per the 2026-08-23 decision, restoring creates a new draft and never rewinds the
learner-facing release in place. A published course restores into
`pending_content` and waits for review like any other update to live material;
only an unpublished course restores onto its own rows.

Six fields are pinned from the CURRENT course rather than taken from the
snapshot — `id`, `slug`, `programSlug`, `status`, `visibility` and
`entitlementProductCodes`. A revision records CONTENT and must not become a way
to travel back to an earlier set of PERMISSIONS: restoring a snapshot from before
an entitlement code was removed would otherwise re-open the course to everyone it
used to admit.

Restore also advances `draft_generation`, so a tab holding the previous document
reloads instead of saving over a version it never saw.

## Migration posture

Two files, both of which **must be applied by hand in the Supabase SQL editor**,
in this order:

1. `docs/migration/sql/2026-09-07_lms_course_release_journal.sql`
2. `docs/migration/sql/2026-09-07_lms_autosave_checkpoint.sql` The MCP connector points at a different
project and cannot run this DDL.

Until it is applied, every path feature-detects (PostgREST answers an unknown
function with `PGRST202`) and behaves as it did before:

- review submission and approval still work, unjournaled, and warn to the server log;
- **restore refuses** with `lms_release_journal_migration_required`. It is new
  capability rather than a flow that already works, and an unjournaled restore is
  the exact shape the version-history doc forbids.

## One read-path fix carried in

`loadCourseRevision` validated stored snapshots in `write` mode. A presentation
ceiling tightened after a revision was written would have made the oldest history
unreadable — the same class of failure that dropped a course from the shelf on
2026-09-01. Revisions are now read in `stored` mode, like `courseFromRows`.

## Точка восстановления автосохранения

Автосохранение в билдере уже существовало: `useCourseAutosave` пишет рабочую
копию примерно раз в полторы секунды и держит durable-копию в браузере. Не
хватало серверной точки восстановления — пятого вида чекпоинта.

Журнал нельзя вести с частотой автосейва: история из тысячи записей за вечер
ничем не отличается от её отсутствия. Поэтому точка редкая и дедуплицированная,
а решение «писать или не писать» целиком внутри
`checkpoint_lms_course_autosave`, а не в коде: дедупликация по хешу и интервал —
свойства данных, и две открытые вкладки одного автора не должны получать разные
ответы на один вопрос (иначе обе прочитают «последняя была минуту назад» и обе
запишут).

Два отказа, оба относительно последней записи журнала **любого** вида:
совпадение `content_hash` (дублировать только что сохранённую вручную версию
незачем) и слишком малый интервал (по умолчанию 10 минут).

В отличие от трёх доказывающих видов, эта запись **best-effort** и намеренно не
входит в транзакцию сохранения. Запрет на save-then-log защищает записи, которые
что-то доказывают; автоматическая точка ничего не доказывает. Не записавшаяся
точка — это одна пропущенная точка, а упавшее из-за неё сохранение — потерянный
абзац у автора, который просто печатал.

### Что при этом пришлось починить в хеше

`courseRevisionHash` считал отпечаток по всему документу, включая `version`.
Каждое сохранение инкрементирует `version` — значит документ, к которому автор
не притронулся, приходил бы с новым хешем, и дедупликация не сработала бы
**ни разу**: точка писалась бы на каждом интервале, включая пустые. Найдено
тестом, а не в продакшене.

`version` из отпечатка исключён. Основание не в удобстве: это «learner
cache/release invalidation and must not be treated as a human-visible revision
number» — служебный счётчик, а не содержание. Сам документ в `content`
сохраняется целиком, вместе с версией.

### Удержание

Ничего не удаляется. Так решено в документе 2026-08-23: автоматические точки
«may later be compacted by policy; the first implementation does not delete
them». Уплотнение — отдельное решение с отдельным сторожем; таблица append-only
даже для `service_role`, и любая чистка потребует собственного гранта, которого
сейчас намеренно нет.

## Разницу стало можно прочитать

Журнал фиксирует точный документ, ушедший на проверку, и точный документ,
ставший релизом. Этого достаточно, чтобы ДОКАЗАТЬ факт, и недостаточно, чтобы
его УВИДЕТЬ: два JSON по двадцать уроков человек глазами не сравнивает. Пока
разницу нельзя прочитать, вопрос «автор переписал материал после проверки?»
формально имеет ответ и практически не имеет.

`diffCourses` в `src/lms-core/diff.ts` — чистая функция, считается **по запросу
и не хранится**: «diff is computed on demand and is not stored as another source
of truth» (2026-08-23). Сохранённая разница была бы третьей копией содержания,
которая расходится с двумя первыми.

Сравнение идёт **по id, а не по позиции**. У модулей, уроков и блоков стабильные
id, поэтому перемещение видно как перемещение. Позиционное сравнение на курсе из
двадцати уроков превратило бы один сдвиг в стену ложных изменений, в которой
настоящая правка теряется.

`version` из сравнения исключён по той же причине, что и из отпечатка: счётчик
двигается на каждом сохранении, и список правок никогда не был бы пустым.

### Отдельный флаг на «межі»

`boundaryTouched` поднимается наверх, а не растворяется в общем счёте. Блок
`boundary_note` обязателен для прохождения проверки, и правка именно его после
одобрения — то единственное изменение, ради обнаружения которого журнал
заводили. Флаг встаёт и на правку, и на удаление, и на добавление, в том числе
внутри группы блоков.

### Где это видно

- **Рецензент**, в админ-каталоге: под курсом с ожидающей ревизией печатается,
  чем она отличается от того, что уже стоит на полке, и отдельной строкой —
  предупреждение про «межі». Раньше он видел `оновлення · in_review` и одобрял
  вслепую. Считается двумя запросами на все ожидающие курсы сразу (обычно их
  ноль или один), а не по запросу на курс.
- **Автор**, в истории версий: открытая версия говорит, чем она отличается от
  того, что сейчас в редакторе — вопрос перед восстановлением именно такой.

Обе поверхности деградируют молча: если разницу посчитать не удалось, курс
остаётся в очереди и версия остаётся открываемой, просто без подсказки.

## Связи, которых не хватало

Три пункта контракта 2026-08-23 были объявлены и не выполнены. Все три — про
СВЯЗИ между записями, а не про сами записи, поэтому их отсутствие ничего не
ломало и ничем себя не выдавало.

- **`published_revision_id` не заполнялась ни разу.** Колонка и внешний ключ
  существовали с августа; контракт говорит «points at the immutable release
  record». Без неё по строке курса нельзя ответить, какая ревизия стоит релизом
  сейчас, — только угадать по времени, то есть тем самым способом, ради отказа
  от которого журнал заводили. Теперь проставляется внутри той же транзакции,
  что проекция и запись: курс, который считается опубликованным, и запись,
  которая это доказывает, не расходятся даже на мгновение.
- **`parent_revision_id` принимался и всегда приходил `null`.** Цепочка «что
  было до этого» не строилась. Родителя выбирает сама функция базы, а не
  вызывающий код: вызывающему пришлось бы сперва прочитать последнюю запись, а
  между чтением и записью встаёт вторая вкладка.
- **Ручной чекпоинт не дедуплицировался**, хотя контракт требует
  («creates a deduplicated checkpoint»). Два нажатия подряд клали в историю две
  одинаковые версии. Решает база — тем же правилом, что и для автосохранения, и
  по той же причине. Отличие в ответе: здесь возвращается СУЩЕСТВУЮЩАЯ запись с
  `created: false`, потому что человек нажал кнопку и ждёт ответа, а пустота на
  месте ответа читается как сломанная кнопка. Маршрут отвечает `200` вместо
  `201`, когда ничего не создано.

## Кто это сделал

`created_by` писался с самого начала и нигде не показывался. Для проверки
«документ такой-то» без «от кого» доказывает половину.

- В истории версий у каждой записи стоит подпись. Имена резолвятся одним
  запросом на всю историю, а не по запросу на строку.
- У рецензента под курсом на проверке печатается, кто подал обновление. Взято из
  журнала (`review_submitted`), а не из колонки: `pending_submitted_at` хранит
  КОГДА и никогда не хранило КТО. Отправка, сделанная до того, как журнал начали
  вести, остаётся без подписи — это честнее, чем подставить туда автора курса.

Подпись — украшение записи, а не сама запись: если имена не читаются, история
показывается без них.

## Not done here

The release batch (Sanity's Content Releases) and scheduled publish remain in
the order `docs/showcase-lms-builder-research-2026-08-22.md` §7 sets. Autosave
itself already existed; only its journal checkpoint was missing.
The journal was the precondition for admitting the H3 agent to writes; that
admission is a separate decision and is not taken by this change.
