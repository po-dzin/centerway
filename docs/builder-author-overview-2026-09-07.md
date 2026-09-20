# Author overview in the workshop — 2026-09-07

## Scope

The workshop's front door stopped being a course list and became the author's
start surface, on the model the personal app already runs: `/profile` answers
«де я», `/learn` answers «що в мене є». `/build` now answers the first question
for an author and `/build/courses` holds the shelf.

## Semantic preflight

| item | answer |
| --- | --- |
| surface | personal workspace (Майстерня, `my.centerway.net.ua`) |
| semantic_role | прогрес (primary), метод and границя (secondary) — the «Дашборд / карта прогресу» archetype, density band *Compact* |
| user_question | «Що з моїми курсами зараз: що чекає на перевірці, що бачать сторонні, що заважає опублікувати, що я змінював?» |
| token_source | global app DS (`cw.tokens.json` → `globals.css`), `PlatformButtons.module.css` for every control, existing `Builder.module.css` recipes. No new palette, radius, shadow or type scale. |
| content_source | `lms_courses` (status, `review_status`/`pending_review_status`, `visibility`, `submitted_at`/`pending_submitted_at`, `approved_at`), `courseReadiness` blockers, `lms_course_revisions`, and aggregate counts from `lms_enrollments` + `lms_progress_events` |
| route_boundary | `/build` and `/build/courses` on the personal host; `GET /api/lms/authoring/{activity,audience}`. Isolated funnels and the admin panel are untouched. |
| selection_family | no new control family. The head's route to the shelf and «Показати всі» are `ink` text controls (`InteractionInkLabel variant="link"`); course names are `ink` navigation (`variant="navigation"`: no mark at rest, stroke on hover and focus); state marks are the shared `CourseStateBadge`. Workshop and course rail rows are icon + label, so they take the stroke only — the `ink-ring` shows only in the compact desktop rail, where the icon is the row. Boundary role: **structural** for panels and tiles, **none** for lists and table rows. |

## Five blocks, each in the shape of its data (2026-09-17)

The first version was five panels of sentences and refused a counter strip on
principle. On real data it read as a wall: every course name underlined at rest,
every fact a clause, the journal the longest block on the page. What survived of
that principle is the part that was right — a number never stands without its
comparison. The screen is now, top to bottom:

1. **Потребує уваги** — courses in review (with how long they have waited),
   returned ones (with the reviewer's note verbatim), and courses with
   publication blockers. First, because it is the only block that asks the
   author to act; one sentence when there is nothing.
2. **Four tiles** — open seats (+ arrivals in 30 days), active in 7 days
   (of how many), lessons completed in 7 days (+ how many finished a course),
   mean progress (+ how many have not started). These are the numbers course
   platforms (Teachable, Thinkific, Kajabi, Podia) lead with, cut down to what
   our tables actually hold. Label, value and note share rows across the strip
   (`subgrid`), so a wrapped label does not push its number down.
3. **Активність учнів** — distinct people who opened a lesson, per Kyiv day,
   over 30 days. One series, one axis, no legend; the readout line above the
   plot is the tooltip (hovered day, else today), and a visually hidden table
   carries every day. Bars use `--cw-platform-accent-pressed`; on the light
   surface that is below 3:1, which the readout and the table relieve.
4. **Курси** — one row per course: name, state badges, visibility (published
   courses only), seats, active, mean progress, finished, blockers. A dash
   where the fact does not apply — a draft nobody was given is not «0 учнів».
5. **Останні зміни** — the journal as a table (коли · курс · подія · хто),
   five rows, the rest behind «Показати всі». Dates are short and in Kyiv time:
   «сьогодні, 19:52», «учора», «13 вер., 19:52», the year only when it differs.

Still no revenue figure. Prices and payouts live in `lms_course_offers` behind an
admin-only policy (`docs/creator-contract-2026-08-22.md`), and gross order sums
per course are the owner's decision to expose, not this screen's.

## Audience: counts are the author's, people are not

The first pass of this screen carried no learner numbers at all, on the reading
that enrolments are the learner's rows rather than the author's. That was too
broad. `lms_enrollments` and `lms_progress_events` do hold the answer to «чи
читає це хтось», which is an author's question about their own work; making them
ask an administrator for it turns the workshop into a place a thought cannot be
finished in.

Where the line actually falls is between the count and the person.
`src/lib/lms/authorAudience.ts` returns counts per course — open and lapsed
seats, arrivals in 30 days, distinct learners active in 7, seats never started,
seats that finished, lesson completions in 7 days — plus a mean progress share,
and one daily series of distinct readers. `GET /api/lms/authoring/audience`
returns those keyed by slug. Account ids are read only to deduplicate the daily
series and never leave the module. No
account, name, email or enrollment id crosses that boundary. This is the rule
`lms_annotations` already sets (an author does not see what a learner
underlined) held one level up: the author learns that seven people opened the
course this week, never which seven.

Two invariants the numbers must keep, both tested:

- **Who counts as a learner is `isAccessOpen`**, the same predicate the player,
  the reminder cron and the admin panel ask. A local «expires_at is in the
  future» would be a fifth opinion, and it would be wrong the first time an
  account was blocked rather than expired.
- **Activity is counted only for open seats**, so «7 активних» can never exceed
  the total beside it. A lapsed learner's last session is real history and still
  not a current reader.

Courses nobody has ever entered are left out of the section rather than listed
at zero: a draft that has not been offered to anyone is not an audience of none.

What the counts raise and do not answer is whether the two sides should be able
to reach each other at all. That is a contract, not a widget, and it is worked
out separately in `docs/author-learner-contact-2026-09-09.md`; nothing from it is
built. Should the «Питання» rung there ever ship, this screen gains exactly one
number — questions awaiting an answer, and how long they have waited.

Completion is **not approximated**: each open seat's events are folded with
the player's own `foldProgress`, uncompletions included, and only lessons the
course has now count towards finishing. The event read is paged (PostgREST caps
a response at 1000 rows) and chunked by enrollment id. At today's volume that is
a few hundred rows per load; if it grows, the fold moves behind an aggregate
rather than into an approximation.

## What the journal contains

Written 2026-09-07 against a journal that only held `manual` checkpoints; ported
2026-09-15 onto main, where `release.ts` now writes `review_submitted`,
`published` and `restored` in the same transaction as the change they record
(`apply_lms_course_release`, `journal_lms_course_state`). «Останні зміни»
therefore shows real review and publication events, each with the actor's name
resolved the same way the course's own version history resolves it — a name the
author already sees there, so no boundary moves.

The section still synthesises nothing from timestamps, and says in words when
the journal is empty.

## Route split and the reserved slug

`/build/courses` is a static segment, and a static segment wins over
`/build/[course]`. A course slugged `courses` would therefore be a course nobody
could open, silently. `BUILDER_RESERVED_SLUGS` (`src/lib/surfaces/catalog.ts`)
closes that at the three places a slug is chosen:

- creation and import add the reserved names to the taken set, so `uniqueSlug`
  steps around them and a course called «Курси» becomes `courses-2`;
- rename refuses with `lms_builder_slug_reserved`, because a rename is a name
  the author typed and answering it with a suffix would rename their course to
  something they did not ask for.

This guards future writes. It does not migrate an existing row — if a live
course already holds the slug `courses`, that has to be renamed by hand before
the static route can be trusted; the shelf's own link would otherwise open the
shelf.

## Data

`listBuilderCourses` gained `reviewStatus`, `reviewNote`, `visibility`,
`hasPendingRevision`, `submittedAt` and `approvedAt`. The first four are read
from the same `loadBuilderCourse` call that already computes the blockers rather
than re-derived from columns, so the pending-revision rule («a waiting version
speaks for the course») exists once. `pending_content` is deliberately **not**
in the list's `select`: it is a whole course document per row.

`listRecentCourseRevisions` is a new metadata-only read across several courses,
exposed as `GET /api/lms/authoring/activity` and scoped by the same
`courseFilterFor(identity)` the shelf uses.

## The frame, not just the page

`BuilderShell` lays out `.body` (page centred in the full width) when a surface
has no `aside`, and `.bodyWithAside` — three tracks, the outer two reserved at
the panel width whatever is in them — when it has one. The course workspace and
the lesson editor were in the second layout and the two root surfaces were in
the first, so crossing from the shelf into a course shifted the document
sideways.

Both roots now pass `BuilderWorkshopRail`, in every state including loading and
failure (a shell that gains its rail when the fetch lands moves the page at the
moment the author starts reading it). What fills that track is the honest answer
to the question the left organ answers — «what is in this place»: the workshop's
two rooms, `Огляд` and `Матеріали`. `selection_family = ink`, drawn with the
shared `InkLabel` and the course rail's own recipe; the icon takes no second
selection ring. The right track stays reserved and empty, exactly as it is on
the course workspace.

## Mobile

Mobile-first, and the overview's block is the last thing in
`Builder.module.css` on purpose: a rule written above a media query loses to any
later top-level rule of the same specificity, which is how earlier builder
overrides came to be discarded without a word. Phone layout is one column: tiles
two across, the chart full width, and each table row becomes a short block —
the header is set aside for screen readers, the name takes the whole line, and
each number prints its column name beside it (dashes are dropped). ≥901px puts
the tiles four across and keeps real tables with a fixed layout, so a long
title truncates instead of running under the numbers.

The workshop rail is `display: none` below 901px, like every builder aside, and
neither root surface mounts an opener for it — deliberately: the overview links
to the shelf from its page head and the shelf's trail leads back, so there is no
control on a phone that opens a panel nobody asked for.

## Verification

- `npx tsc --noEmit`, ESLint: clean.
- `builderOverview.test.ts` (12 assertions incl. Ukrainian plurals and the
  future-timestamp case) and the extended `useBuilderExit.test.ts` pass.
- `npm run ds:qa` — see the run recorded with this change.

`ds:sync:check` drift against the Claude Design mirror (`tokens/colors.css`,
`tokens/delivery.css`, `_sync.json`) is pre-existing and is **not** closed here:
discovery and closure are separate passes (`CLAUDE.md`, design contract).
