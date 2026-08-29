# Author profile showcase — 2026-08-29

## Scope

This iteration joins the author editor, course byline and public author page into one profile contour without adding a second author record.

## Runtime contract

- `/profile` remains the only editor for `lms_authors` identity fields.
- A listed saved profile exposes an explicit “view public page” link to `/expert/[slug]`.
- The course builder's Author tab links the caller's own `lms_authors` row through `lms_courses.author_profile_id`; per-course `authorNote` remains separate.
- `/expert/[slug]` is a public trust/showcase route. It renders identity, status, credentials and publicly listed authored courses.
- The cabinet's “all courses” route is a text doorway, not a card, and is omitted when the account owns zero or one course.
- A completed dosha result is shown in the cabinet’s dedicated progress card and text stat; it does not outline the avatar.
- An author may upload a decorative background for their own public showcase. The file uses the existing server-side media pipeline and is covered by a semantic overlay; identity and profile content never depend on the image for legibility.

## Deferred data contract

A manually curated list of completed courses is not inferred from private enrollments and is not mixed into `lms_authors`. It needs an explicit public-showcase relation with owner-controlled visibility, ordering and removal before it can ship.

## Canon decision

This is a route-local implementation refinement of the existing `/profile`, `/expert/[slug]`, `/learn` and course-author contracts. No route boundary or global token invariant changes in this iteration, so the shared RAverse canon does not need promotion yet.

## Migration record

`supabase/migrations/20260829205051_author_profile_background.sql` adds `lms_authors.background jsonb`. It was applied to the configured remote database with `supabase db query --file` on 2026-08-29 and then verified through `information_schema.columns`.

The local `supabase/migrations` ledger does not contain historical remote versions, so `supabase db push --dry-run` correctly stops before applying migrations. Do not repair that history as part of this feature; reconcile it in a dedicated migration-governance cycle.
# Editor layout follow-up — 2026-08-30

For the `/profile` author editor, desktop now separates media identity from
profile writing: portrait and optional background sit in a fixed left column,
while name, role, biography, credentials, public address and visibility remain
in the right column. Compact layouts preserve the original one-column source
order. The disclosure uses the same visible chevron as other cabinet folds.
