# LMS reader — memory and marks

Status: implemented 2026-08-28. Two waves in one pass: what the reader's device
remembers, and what the reader writes.

## Contract

- Surface: learner lesson (`/learn/[course]/[lesson]`), course map
  (`/learn/[course]`), and the same renderers inside Zen Preview.
- Semantic role: continuity (where I was) and marginalia (what I marked).
- User question: *where did I stop, how much is left, and where was that
  passage I need again?*
- Token source: existing LMS/platform button, material and ink recipes; no new
  visual token.
- Content source: lesson blocks (anchors), `lms_annotations` (marks),
  `localStorage` (position and text size).
- Route boundary: personal `my.` surfaces only; the builder's draft preview
  writes neither progress nor marks.

## Wave 1 — what the device remembers

| Behaviour | Where it lives | Why on the device |
| --- | --- | --- |
| Reading position per lesson | `cw.reader.pos:<course>/<lesson>` | A pixel offset means nothing on another screen. |
| Text size, four steps | `cw.reader.scale` | Chosen for the phone you read on, not for the account. |

Restoring is not one jump: the offset is re-aimed every frame for 1.5 s against
the document's current height, because a lesson grows as its images arrive. The
first gesture from the reader ends the aiming. Nothing is saved before the
restore has run. An explicit `#block-…` in the URL wins over the saved mark —
that is what makes a note's deep link land where the note is.

`--cw-reader-scale` multiplies the course's own `--cw-course-body-size` on
`.blocks`, and every rule inside that column is sized in `em`, so one number
moves headings, captions, list markers and table type together.

Also in this wave: «лишилось ~N хв» past 8 % of the body, the contents drawer
opening scrolled to the current lesson (its head is sticky for that reason), and
← / → pressing the pager's own links, so the keys can never reach a neighbour
the page decided not to offer.

## Wave 2 — what the reader writes

Three names, two shapes, one table (`lms_annotations`):

- **bookmark** — the lesson. One per lesson per reader (partial unique index);
  the control is a toggle in the reader's own row of tools.
- **highlight** — a passage.
- **note** — a highlight carrying `note`. There is no third kind.

**Private, and private means private.** The table is the only `lms_*` table with
no staff read policy: the course's author, support and an admin all have no
route to a reader's notes. The API resolves the enrollment from the bearer token
on every call and filters by it, which is where the privacy is actually kept —
service-role code bypasses RLS everywhere in this codebase.

### Anchoring, and what happens when the author edits

A highlight is `(block_id, start_offset, end_offset)` over the block's
whitespace-collapsed text, plus the `quote` it was made from and the ~40
characters of `prefix` before it. `resolveAnchor` (`src/lms-core/annotations.ts`)
tries three things in falling order of confidence: the stored offsets verified
against the quote; `prefix + quote`, which separates a phrase that repeats; and
the occurrence of the quote nearest to where the mark used to be. A mark whose
quote is gone is **detached, never deleted** — it keeps its place in the notes
list with the text the reader marked.

### Drawing

The wash is painted through the **CSS Custom Highlight API**, so the block tree
React renders is never touched — no `<mark>` wrappers, no split nodes across an
inline link. The two `::highlight()` rules are installed from
`src/components/lms/readerMarks.ts` as a constructed stylesheet rather than from
`globals.css`: Lightning CSS (Turbopack) rejects the selector outright and takes
the whole stylesheet down with it. A browser without the registry throws on
`insertRule` — and it is the same browser that could not paint anyway, so the
marks live in the list and say so once, quietly.

Notes also stand as a dot in the margin. The dot is a **button** in the tab
order: pressing the marked words opens the note too, but that route runs through
caret hit-testing and reaches nobody on a keyboard.

### Reading them back

The course map carries «Мої позначки», in the course's own order — lesson by
lesson, passage by passage, never "most recent first". Without it the marks
would be write-only: a highlight you can only find by re-reading the lesson it
is in has to be remembered to be used, which is the problem it was made to
solve. Each row links to `…/lesson#block-<id>`.

## Validation

- `src/lms-core/annotations.test.ts` — anchor repair (edit above, repeated
  phrase, passage gone), ordering, clamps.
- `src/components/lms/readerSettings.test.ts` — position TTL, reflow rescaling,
  remaining minutes, size persistence.
- Manual, against `way21 / w1-nutrition` on the dev server: mark → reload →
  re-found and painted; note → margin dot + stronger wash; bookmark toggle;
  course-map list with block deep links; delete from both the sheet and the list.
- Migration: `docs/migration/sql/2026-08-28_lms_reader_annotations.sql`, applied
  through `supabase db push` on 2026-08-28.

## Known limits

- A mark cannot span two blocks. A range that runs from one paragraph into the
  next has no single anchor to survive an edit between them, and the reader who
  drags past a heading almost always meant the sentence.
- Marks are not exported anywhere yet. When a reader's own material becomes a
  thing they can take with them, this table is the source.
- Nothing in the notes list is searchable yet; the lists are short enough that
  ordering answers more than a search box would.
