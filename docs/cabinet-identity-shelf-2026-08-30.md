# Cabinet identity and shelf adjustment — 2026-08-30

## Scope

- Surface: personal platform dashboard.
- Route boundary: `/profile` only; the complete course library remains `/learn`.
- Identity block role: orientation — answers «чей это кабинет?».
- Shelf role: progress / next step — answers «какой курс продолжить и где вся библиотека?».
- Token source: existing platform semantic and material tokens delivered through `globals.css` and the cabinet modules.
- Content source: signed-in account identity, platform role and LMS course shelf.

## Decision

- The dosha result is shown in its dedicated progress card and the textual hero fact; it does not frame the avatar.
- A meaningful staff role (`Адміністратор`, `Підтримка`, `Куратор`) is profile context beside the person’s name. It is omitted from the account menu, whose task is navigation and session actions.
- The personal topbar calls `/learn` `Бібліотека`; it names the destination rather than the subset a person owns.
- With one or more courses, `Усі мої курси` remains a plain link to `/learn`, directly below the resume course, with the baked handwritten arrow used for platform forward movement. On desktop the dosha card occupies the adjacent course-card track only, rather than stretching through the library-link row or leaving a card-sized middle slot.
- The cabinet's lower reference sections remain collapsed by default at every viewport. The author editor is a full-width CSS grid on desktop: compact media controls in the left track, all text fields and actions in the right track. An author-selected public-page image is a top banner rather than a background behind identity and course content.
- Author-editor micro-actions follow the reuse-first control rule: adjacent add/edit/remove commands are accessible icon-only contour controls, while ambiguous or primary outcomes retain text. The publishing setting uses the shared system checkbox grammar with its box before the copy.

This is a route-local composition adjustment, not a new cross-platform token or route-family rule; no RAverse update is required.
