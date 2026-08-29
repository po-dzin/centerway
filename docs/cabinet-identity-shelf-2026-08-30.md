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
- With one or more courses, `Усі мої курси` remains a plain link to `/learn`, directly below the resume course. On desktop the dosha card occupies the adjacent column instead of leaving a card-sized empty middle slot.

This is a route-local composition adjustment, not a new cross-platform token or route-family rule; no RAverse update is required.
