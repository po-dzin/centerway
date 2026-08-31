# Shared notifications and missing menu glyphs

## Scope and preflight

User-requested surfaces: platform, library, Builder, admin. Funnel notification
behaviour is excluded. Existing unrelated worktree changes are preserved.

- Notification role: support / action feedback. Question: did my operation
  succeed, fail or need attention? Source: existing API result messages and
  current copy, not new data contracts. Tokens: existing material, status,
  spacing, z-layer and button tokens. Boundary: quiet overlay. Close control:
  `selection_family=ink`; no selection on the notification's message body.
- Export / unpublish glyphs: method / command recognition. Question: take a
  portable copy or remove public availability? Source: existing course menu
  actions. Same baked icon family; menu semantics, confirmation and labels
  unchanged. Routes: `/build` and existing authoring actions only.
- Provider roots: `(platform)` includes `/learn`, `/profile` and `/admin`;
  `(builder)` handles the workshop and editors. No route/auth changes.

## Cause

The existing admin `ToastProvider` was route-local. Builder used a nullable
`note` string and rendered `noticeLine` inside the page grid, so the exported
filename acquired a whole row and pushed search/results/cards down. It also
used the same boundary tint for successful and failed operations.

## Implementation

- Reuse and extend `ToastProvider`, remove admin's nested instance and mount
  once per application root. Keep existing admin API compatible; add warning.
- One fixed top-right viewport, bounded width, mobile safe areas, DS layer and
  colours; one close/timeout policy. Five-second default; independent hover,
  focus and document-hidden pauses; cleanup; repeated-message renewal.
- Migrate workshop create/reorder/export/import results, course and lesson
  editor transient feedback, version-history operations and profile-save
  outcomes. Keep autosave state, recovery prompts, file-validation errors and
  destructive confirmation/refusal controls contextual.
- Add export (document + outgoing arrow) and unpublish (interrupted eye) to
  `icon-glyphs.mjs`, bake `hand2`, wire both blank course-menu slots.
- Regenerate platform sprite, typed names and the mandatory identical static
  sprite mirror. No funnel layouts, consumers or notification behaviour change.

## Verification

- `lint`: passed, no hook dependency warnings after final adjustment.
- `test:unit`: 79 files / 764 tests passed.
- `build`: passed, 102 pages. Existing live-list fallback to shipped snapshot
  occurred during static generation; this is not authenticated runtime QA.
- `icons:build` / `icons:check`: 71 glyphs + 6 graphics, deterministic hand2.
- DS and button guards passed.
- New tests cover timer expiry, overlapping pause reasons, disposal, persistent
  duration, provider-root ownership, no funnel mount, removed transient rows,
  semantic announcements, fixed/safe-area geometry and generated menu icons.
- Icons inspected in the generated design-system preview; artifact:
  `/private/tmp/centerway-notification-icons-20260830/icons-preview.png`.
- Authenticated export/import flows and mobile notification appearance have
  not been visually accepted in this run; no protected actions were fabricated.

## Durable rule

One notification mechanism across the four application surfaces is recorded
in the local DS and agent preflight; promote the concise behavioural invariant
to the shared UI-UX canon. Full implementation and test details stay local.
