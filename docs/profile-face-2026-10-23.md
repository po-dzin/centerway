# Profile face: the avatar as a control, one viewer (2026-10-23)

Source: the approved «Профіль CenterWay» design canvas, Main board (desktop) and
Phone board. Ukrainian copy is taken from those boards.

## Preflight

| Block | surface | semantic_role | user_question | token_source | content_source | route_boundary |
|---|---|---|---|---|---|---|
| `ProfileFace` (cabinet hero avatar + sheet) | platform utility (`/profile`) | orientation (identity) | «How do I see or change my face?» | global DS delivery tokens (`--cw-mat-*`, `--cw-radius-*`, `--cw-space-*`, `--ds-*`), button roles from `PlatformButtons.module.css` | new product copy from the canvas | platform route |
| `PhotoViewer` actions row | platform, shared | support | «Can I act on this picture from here?» | same; `onMedia` role | — | platform |
| `ProfilePhotos` (author page portrait) | expert page (`/expert/[slug]`) | trust | «What does this person look like, full size?» | same | database (`lms_authors.photo`, `.background`) | platform route |

`selection_family`: the face button, the sheet's buttons and the portrait
trigger are **contour** (focus ring, the role's own surface); the
«Кадрувати, ім'я, обкладинка» link is **ink** (`InteractionInkLabel
variant="link"`). Boundary role of the sheet: **quiet** overlay (raised material
shadow, no outline).

## What the block does

Pressing your own avatar in the cabinet hero opens a small sheet beside it:

- **Переглянути** — opens `PhotoViewer` (the feed's viewer, now shared) on the
  current face, with **Завантажити** on its bottom glass row.
- **Завантажити фото** — picks a file and uploads at once. No draft and no
  save button: the result is the face everywhere. Toast on success:
  «Нове фото вже всюди: топбар, коментарі, сторінка автора, Стрічка, тести й
  програми.» (A learner with no author page gets the same sentence without
  «сторінка автора».)
- **Кадрувати, ім'я, обкладинка** — `#author`, which opens the author fold.
  Offered only to accounts eligible for an author profile; a learner has no
  name/crop/cover editor yet, so the link is absent rather than dead.
- **Згенерувати** is not built. Avatar generation waits on pricing.

The pen mark sits on the circle's start corner, not the end corner the canvas
draws: the end corner already carries the Telegram reach dot.

On the author page the portrait opens the same viewer, with the cover as the
second picture when there is one.

## Where an upload is written, and why

`POST /api/platform/users/me/avatar` (any signed-in account). The bytes take the
author-portrait path, now shared as `src/lib/media/profileImage.ts`: the
course-cover pipeline, the `course-media` bucket, one `lms_media_assets` row.

- **An account with an author profile:** the picture goes into
  `lms_authors.photo.src` (`setAuthorPhoto`; crop fields kept, as the fold's
  own «Інше фото» does), and `syncAccountFromAuthor` writes `cw_avatar` from
  it. Evidence that only the profile can be the source: the cabinet's
  `GET /api/platform/users/me/author` re-syncs the account from the profile
  whenever they differ, so writing `cw_avatar` alone would be undone on the
  next cabinet open; and the feed, comments and bylines show an author as
  their profile (`src/lib/feed/server.ts` reads `lms_authors.photo` for
  authors, `platform_users.avatar_url` only for people without one).
- **Any other account:** `cw_avatar` on the account, crop cleared
  (`accountMetaFromUpload`).

Either way `auth.users` changes, the trigger from migration 20261022160000
mirrors it into `platform_users`, and the client refreshes its session so the
topbar (which reads the token) changes at once.

Folders: `authors/<id>/<uuid>` for authors, `accounts/<id>/<uuid>` for others.
No migration was needed.

## Media sweep

`lms_referenced_media()` reads course documents only, so every picture under
`authors/` (already, before this change) or `accounts/` looked like an orphan
to `npm run media:sweep` once past the grace period. `planSweep` now collects
only `courses/` and reports the rest as `outside`.

## Cover room and glass topbar: already in place

- The cabinet hero's plate declares `data-cw-topbar-tone="dark"`;
  `headerTone.ts` reads it and the bar takes `data-cw-header-tone="dark"`, which
  re-declares the whole `--cw-mat-*` family to the night side in
  `globals.css`. The band is then `--cw-mat-tint-chrome` = night surface at the
  chrome floor (30%) with grain and blur — the canvas's onMedia glass exactly.
- Below 901px the chrome is already two floating islands (`ChromeOrgans`,
  `[data-cw-chrome="organs"]`) sampling the same tone.
- The author page's cover band sits in flow below the bar, so the bar is never
  over it.

Nothing was changed there. Follow-up, from the «Ви» board: a user-chosen cover
(«скіни») replacing the cabinet's fixed room plate.
