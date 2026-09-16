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
| selection_family | no new control family. The head's route to the shelf and every entry name are `ink` text links (`InteractionInkLabel variant="link"`); status marks are non-interactive `.pill`s. Boundary role: **structural** for the four panels, **none** for the lists inside them. |

## Five questions, and nothing else

1. **Перевірка** — what is out of the author's hands, and for how long.
   `in_review` and `changes_requested` in one section, because they are two
   positions in one cycle; the reviewer's own note is printed verbatim.
2. **Опубліковані** — status and visibility are two switches and the section
   says both. A published course at `visibility = hidden` is invisible to
   everyone but its author, and the workshop never said so anywhere before.
3. **Учні** — how many people are inside each course and how many of them are
   still moving. See the section below: this is the author's own question about
   their own work, and it stops at counts.
4. **Що заважає опублікувати** — `courseReadiness` blockers per course, linking
   to `#course-release`, where they are actually fixed.
5. **Останні зміни** — the `lms_course_revisions` journal.

There is no counter strip and no revenue figure. Prices and payouts live in
`lms_course_offers` behind an admin-only policy
(`docs/creator-contract-2026-08-22.md`), and an author who could read their own
revenue reporting here would be reading a table the creator contract keeps on
the house's side. Five true sections beat seven with two plausible zeros in them.

## Audience: counts are the author's, people are not

The first pass of this screen carried no learner numbers at all, on the reading
that enrolments are the learner's rows rather than the author's. That was too
broad. `lms_enrollments` and `lms_progress_events` do hold the answer to «чи
читає це хтось», which is an author's question about their own work; making them
ask an administrator for it turns the workshop into a place a thought cannot be
finished in.

Where the line actually falls is between the count and the person.
`src/lib/lms/authorAudience.ts` returns four integers per course — open seats,
lapsed seats, arrivals in 30 days, distinct learners active in 7 — and
`GET /api/lms/authoring/audience` returns those integers keyed by slug. No
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

The one number deliberately absent is «завершили курс». Completion has exactly
one definition in this codebase — `foldProgress` over the append-only event log
— and honouring it per learner means folding every event of every enrollment on
each dashboard load. It is worth doing behind a real aggregate; it is not worth
approximating.

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
overrides came to be discarded without a word. Phone layout is one column of
panels with ruled text lists; ≥901px pairs the four sections into two columns.
Each entry row carries `min-height: var(--ds-touch-target-min)`, so the name is
a hand-sized target without the link claiming a button's box.

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
