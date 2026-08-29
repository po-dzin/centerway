# Author profile showcase — 2026-08-29

## Scope

This iteration joins the author editor, course byline and public author page into one profile contour without adding a second author record.

## Runtime contract

- `/profile` remains the only editor for `lms_authors` identity fields.
- A listed saved profile exposes an explicit “view public page” link to `/expert/[slug]`.
- The course builder's Author tab links the caller's own `lms_authors` row through `lms_courses.author_profile_id`; per-course `authorNote` remains separate.
- `/expert/[slug]` is a public trust/showcase route. It renders identity, status, credentials and publicly listed authored courses.
- The cabinet's “all courses” route is a text doorway, not a card, and is omitted when the account owns zero or one course.
- A completed dosha result may outline the cabinet avatar, but its text value remains present so colour is not the only carrier of meaning.

## Deferred data contract

A manually curated list of completed courses is not inferred from private enrollments and is not mixed into `lms_authors`. It needs an explicit public-showcase relation with owner-controlled visibility, ordering and removal before it can ship.

## Canon decision

This is a route-local implementation refinement of the existing `/profile`, `/expert/[slug]`, `/learn` and course-author contracts. No route boundary or global token invariant changes in this iteration, so the shared RAverse canon does not need promotion yet.
