# Library and workshop control flow — 2026-08-30

The learner library and author workshop are two applications over one course
collection. They share the same top-to-bottom reading order, while preserving
their different primary jobs.

## Shared hierarchy

1. **Application context** — the common platform chrome identifies whether the
   reader is in `Бібліотека` or `Майстерня`.
2. **Page answer** — `PlatformPageHead` names the surface. The learner-facing
   title is `Мої матеріали`: the library may contain courses and other owned
   material. The workshop title is `Матеріали` for the same reason; its lead
   explains the authoring work rather than narrowing the collection to one
   current entity type.
3. **Find and narrow** — search is the first content operation. Its lens and
   text field form one bounded control; hover and focus use the same
   ink-and-gold state. Categories are a separate, unplated multi-select
   disclosure with checkboxes. Selecting several categories is additive (`OR`),
   then the typed query narrows that result.
4. **Choose representation** — card/list/room switches change only the
   representation of the already narrowed collection. They do not filter or
   reorder it.
5. **Act on a material** — each card or row opens the material. Per-course
   actions remain in its overflow menu; list-wide creation/import exists only
   in the workshop page head.

## Workshop-specific order

The workshop has two additional list-level operations, so it follows a stricter
sequence than the learner library:

1. `Майстерня / Матеріали` identifies the authoring space; its lead says that
   the user can create, edit and publish learning materials.
2. `Новий курс` is the sole named primary action beside that heading.
   `Імпортувати` is the compact icon-only utility action, with an accessible
   name and tooltip. They change the collection and therefore do not share a
   band with filters or the view choice.
3. Search and `Фільтри` narrow the existing collection.
4. The shared faded result band names `Матеріали`, reports the current count,
   and owns the row/card representation switch.
5. Cards and rows expose only the action that belongs to that particular
   course through their overflow menu.

## Boundaries

- The query belongs to the current visit and is not persisted; the chosen view
  is a device preference and is persisted.
- The result count is always shown for a non-empty shelf, including a single
  material. Representation controls appear only when there are at least two
  materials to represent.
- A selected category is always removable through `Усі` in the filter popover.
- Search, category selection and view switching are intentionally distinct
  controls: they answer respectively *what am I looking for*, *which subjects
  are included*, and *how should the result be shown*.

This is an implementation-level operating note. It does not change the shared
canon: all control geometry and state marks remain sourced from the existing
platform tokens and baked `ink-stroke` / `ink-ring` gestures.

## Selection families

- Search is `contour`: one bounded field contains both lens and text; it is the
  only outline in the find-and-narrow row.
- `Фільтри` is the contour trigger of the `hybrid` filter: icon, label and
  reserved counter slot form one button. The selected category state lives only
  inside its list of options; no icon ring is added around the button's glyph.
- The filter popover is `hybrid`: its physical checkbox box keeps a contour;
  the selected category label uses the shared account-menu ink stroke.
- The result-band view choice is `ink`: icon-only options with the shared ring,
  no track or plate. The band itself is a faded boundary, not a control.
- Creation is `contour` / primary. Import is `ink` / icon-only utility.
