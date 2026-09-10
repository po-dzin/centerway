# LMS journal — the reader's own book

Status: **wave 1 implemented 2026-09-10; wave 2 (ink) not started.** The
direction was written before the code, so the decisions below are decisions
rather than discoveries — and where the build corrected one, it says so.

## The gap

The substrate is already here and it is good. `lms_annotations`
(`docs/migration/sql/2026-08-28_lms_reader_annotations.sql`) holds bookmarks and
highlights with quote-repaired anchors, and its privacy is real: it is the only
`lms_*` table with no staff read policy, and `src/lib/lms/annotations.ts` keeps
that promise by refusing to accept a user id — every function takes an
`enrollment_id` the caller has already resolved from the session.

What is missing is the place where all of it lives together. `CourseNotes.tsx`
lists marks **inside one course**. A reader taking three courses has three
lists, each reachable only by opening the course it belongs to. So the marks are
still half write-only: to use what you wrote you have to remember which course
you wrote it in.

The journal is the answer, and it is deliberately not another view of the
reader: **there you read someone else's text, here you write your own.**

## Contract

- Surface: `my.centerway.net.ua/journal`, entered from the cabinet and from the
  shelf. One address, all courses.
- Semantic role: marginalia gathered — the reader's own material, in their own
  order, pointing back into the text it came from.
- User question: *what have I written, and where in the course was it?*
- Token source: existing platform ink and material recipes. One new decision
  about the reader's stroke tone (below); no new visual family.
- Content source: `lms_annotations` across every enrollment of the signed-in
  reader; lesson and course titles resolved for display and deep links.
- Route boundary: personal host only. Nothing here has a public address, and
  nothing here is ever readable by an author, support or an admin.

## The four decisions

**1. A third kind, done properly.** The 2026-08-28 migration states outright
that "a highlight carrying `note` IS the margin note; there is no third kind".
A drawing is a third kind. We are breaking that sentence on purpose, so it gets
its own arm of the anchor constraint, its own column and its own paragraph in
the migration header — not a quiet `'ink'` slipped into the CHECK list. The old
sentence was true about *text*: there is still no third kind of writing. Ink is
not writing, it is a mark of the hand, and that is why it earns a kind rather
than a flag.

**2. The reach across courses stays honest.** The journal by definition reads
past a single enrollment, which is exactly what `annotations.ts` forbids. The
widening is one function, `listJournalMarks(enrollmentIds)`, taking **an array
of enrollment ids somebody else resolved** — the module's invariant ("no
function here accepts a user id, and none accepts a filter that could cross a
reader") survives literally, and an empty array reads nothing rather than
everything, which is the one way a plural filter fails open.

The crossing itself lives in `src/lib/lms/journal.ts` rather than in the route
handler, which is the one place the plan moved: the page and the API would
otherwise have needed the same eleven lines each, and a privacy step written
twice is a privacy step that will drift. `loadJournal(identity)` is now the only
function in the codebase that turns a person into a list of their enrollments
for this purpose.

One consequence, stated where it lands: **expiry ends access to the course, not
to what you wrote about it.** A reader whose `lms_enrollments.expires_at` has
passed still sees their entries and the quotes they saved; the deep link into
the lesson may bounce them to the offer. Their own words were never the thing
that was sold.

**3. The stroke is simple, and its colour is not a choice.** A stroke is a
vector path — not a raster. Raster is a picture: it needs storage, it does not
scale, and it arrives in the dark theme as a sticker.

- **Type:** two pens. `pen`, an even line; `marker`, a wide translucent one.
  Not five, not pressure-sensitive. Pressure is a property of hardware most
  readers do not have, and a line that changes width on a trackpad but not on a
  phone is two different tools wearing one name.
- **Width:** three steps, chosen by the reader.
- **Tone:** **ink on light, gold on dark** — and *not* a reader control. This is
  already the design system's rule for every mark at levels 1 and 2: "the dark
  theme does not swap strokes for glow — it writes the same stroke in gold"
  (`docs/design-system.md`, "State is a stroke, not a plate"). Making tone
  derived rather than stored means a drawing made in daylight is still legible
  at night, which a stored colour could never promise.
- Coordinates are normalised to their box, so a stroke survives a resize and the
  reader's four text sizes — the same instinct as quote-repaired anchors.

Because the reader's own hand is gold on dark, **the journal page carries no
primary button**. "Max one gold per screen" is a design-system rule, and on this
screen the gold is spent on the reader.

**4. Publishing is on the horizon, and it is a copy out — never a flag.** See
below.

## Wave 1 — the feed (built)

The journal without any drawing at all, because it is the piece that is missing
and it is useful alone.

A single stream, newest first, across every course the reader is enrolled in.
Each entry shows the reader's own note, the passage it was made from, the course
and lesson it came from, and links to `…/lesson#block-<id>` — the deep link that
already works.

Ordering differs from the course map on purpose. «Мої позначки» inside a course
is in the course's own order, because there the question is *where in this
material*. The journal is a record of a practice, so its axis is time.

Three things the build settled that the plan had not:

- **The note stands above the quote, and is not clamped.** On the course map the
  passage is what is being hunted for and the note is a two-line aid to finding
  it. In the journal that is inverted — the reader's own words are the content —
  and a journal that truncates what you wrote is a journal you cannot read. The
  quote keeps its three-line clamp underneath, behind a margin rule.
- **Sorted on `createdAt`, never `updatedAt`.** Editing a note a fortnight later
  must not lift the entry out of the day it was written in.
- **The day is cut in the reader's own timezone**, which the API sends alongside
  the entries rather than baking into them: one payload has to serve a reader
  who travels. A note written at 00:30 in Kyiv belongs to that night, not to the
  day before it in UTC.

Where it is reached from: the cabinet, one crossing below the hero — the first
screen answers «what do I open now» and took two passes to get down to one
course and one way onward — and from «Мої позначки» inside a course, where a
reader asking *where was that* is one step from asking *what else have I
written*. Deliberately NOT in the personal navigation bar: that bar names
applications (library, workshop), and the journal is a room inside one.

## Wave 2 — ink in the margin

Schema, as an addition to `lms_annotations`:

- `kind` gains `'ink'`.
- `strokes jsonb NOT NULL` for ink rows, NULL for the other two: an array of
  `{ pen, width, points: [[x, y], …] }`, coordinates normalised inside a
  **named** coordinate space (see the horizon — do not hard-code "the margin" as
  the only space a stroke can live in).
- `anchor_client_id text NULL`, self-referencing `(enrollment_id, client_id)`
  with `ON DELETE CASCADE`: a stroke drawn beside an entry belongs to that
  entry and dies with it. NULL means the stroke belongs to the lesson's margin
  rather than to one entry.
- The anchor CHECK gains a third arm: ink has no `block_id`, no offsets, no
  `quote`.

One thing to watch: the reader loads every annotation of a course to repaint its
highlights. Ink blobs must not ride along — that query selects its columns
explicitly, and a test should hold it to that.

## What the address costs

**On the personal host an unclaimed path is a course.** `personalRouteFor`
(`src/lib/surfaces/catalog.ts`) sends everything that is not `/build` or
`/profile` under the learner tree, so `my.centerway.net.ua/journal` would have
resolved as a course with the slug `journal`. The segment is now registered in
`PERSONAL_PATH_PREFIXES` **and** in that function's list of "addresses in their
own right", and `catalog.test.ts` — which walks the router — carries a case for
both directions plus the exclusion that keeps `/journal` out of
`PUBLIC_ROOT_SEGMENTS`.

The cheaper alternative is `/profile/journal`, which needs no catalog change
because the cabinet is already an address. It is rejected: the journal is a
surface a reader returns to directly, and a thing you return to has a name.

## Horizon — publishing, and the shared canvas

The idea this direction came from does not stop at a private book: an entry you
choose to publish into a common feed, and eventually a shared canvas or map of
knowledge that several readers draw on together.

That is not wave 3 of this document, and one rule must be fixed now so it stays
possible without costing the privacy that makes the journal worth having:

> **A published entry is a copy out of `lms_annotations` into a table of its
> own, authored by an explicit act. It is never an `is_public` column on the
> private table.**

The moment that table needs a public read policy, the sentence it was built on —
nobody but the writer, not even the author of the course — is gone, and no
amount of careful predicate keeps it. A copy also matches what publishing
actually means to a person: the note in my book stays mine and unchanged; what
went out is a separate thing I made from it.

The stroke format is where the shared canvas reaches back into wave 2: keep the
coordinate space named, so the same `strokes` value can be interpreted in a
margin, on a page, or on a wall.

## Open questions

- **A free entry.** Can the reader write a page that is attached to no lesson at
  all? It makes the journal a real notebook and it makes `lesson_id` nullable,
  which touches every index. Probably yes, probably not first.
- **Search.** The course lists are short enough that ordering answers more than
  a search box. A cross-course journal is the surface where that stops being
  true — but only after there is something in it.
- **Export.** The 2026-08-28 doc already names this table as the source when a
  reader's own material becomes something they can take away. The journal is
  where that button will be asked for.

## Validation

Wave 1 needed **no migration**: the feed is a second reading of rows that have
existed since 2026-08-28.

- `src/lms-core/journal.test.ts` — ordering by writing time, the day cut in the
  reader's zone, and the three ways an entry can lose its place without losing
  its text (lesson gone, course gone, window closed).
- `src/lib/surfaces/catalog.test.ts` — the address in both directions, and the
  router walk that catches a half-registered segment.
- `npm run ds:qa` before publishing: the page carries no button styling of its
  own (the two state panels borrow the button contract), which is exactly the
  claim `guard:buttons` exists to check.

Still owed for wave 2, when ink arrives:

- Unit tests for the stroke model: normalisation, round-trip, clamped point
  counts.
- A test that the reader's course-load query does not select `strokes`.
- Migration under `docs/migration/sql/`, applied and recorded in
  `schema_migrations`; the doc tree is not the log of what is applied.
