# Builder course version history

## Decision

Autosave and version history are different layers.

- `pending_content` (or the relational draft before first publication) is the
  mutable working copy. Autosave may replace it frequently.
- `lms_course_revisions` is an append-only journal of meaningful immutable
  checkpoints. Restoring an old revision creates a new draft; it never rewinds
  the learner-facing release in place.

This keeps editing quiet without producing one permanent version per typing
pause.

## Checkpoint kinds

- `manual` — an author names or explicitly keeps a checkpoint;
- `review_submitted` — exact document sent to moderation;
- `published` — exact document projected to learner rows;
- `restored` — new working draft created from an older revision;
- `autosave_checkpoint` — coarse recovery point, deduplicated by content hash
  and retained for a bounded period rather than every autosave request.

Review submissions, publications, manual checkpoints and restore events are
permanent audit history. Automatic recovery checkpoints may later be compacted
by policy; the first implementation does not delete them.

## Data contract

Each revision carries `course_id`, monotonic `revision_number`, immutable full
typed `Course` JSON, SHA-256 `content_hash`, kind, optional label, actor,
parent/source revision and timestamp. `lms_courses.revision_seq` allocates the
human sequence atomically. `published_revision_id` points at the immutable
release record without replacing the existing relational learner projection.

The table is server-only. `anon` and `authenticated` receive no grants; Builder
continues to authorize ownership through `resolveBuilderIdentity` and
`canEditCourse`, then uses the server-side service client. RLS remains enabled
as defense in depth.

## Concurrency boundary

`draft_generation` provides optimistic concurrency for whole-course saves. The
Builder loads the generation with the course and a save atomically claims
`N → N + 1` with `UPDATE … WHERE draft_generation = N` before it changes the
working copy. A second tab with an older generation receives HTTP `409` and
must reload; it cannot silently overwrite the first tab.

The claim is intentionally fail-closed. If a later relational structure write
fails, the generation still advances and the author reloads rather than retrying
against an unknown partially written state. The next wave moves the structural
write and review/publish/restore journal event into one database transaction.
This is separate from `Course.version`, which remains learner cache/release
invalidation and must not be treated as a human-visible revision number.

## API and UX sequence

1. `GET .../revisions` lists metadata without loading every JSON document.
2. `POST .../revisions` creates a deduplicated checkpoint from the current
   Builder document.
3. `GET .../revisions/{id}` loads one document for the Builder side sheet. The
   base UI shows its type, timestamp and course outline without pulling every
   JSON document into the timeline request.
4. `POST .../revisions/{id}/restore` is enabled only after restoring the draft
   and appending its `restored` checkpoint happen in one database transaction.
   A two-request or save-then-log implementation is forbidden because it can
   report failure after the document has already changed.
5. Builder history is a side sheet/timeline with date, kind and label. Manual
   checkpoints are available only after the mutable working copy is saved.
   Actor presentation and diff remain the next UI increment; diff is computed
   on demand and is not stored as another source of truth.

## Operational order

Apply `2026-08-23_lms_course_version_history.sql` before enabling revision API
routes. The current safe API slice is list, create checkpoint and load one
revision for preview. Restore, review and publish checkpoints stay disabled
until their document mutation and journal insert share one transaction.
Backfill published snapshots only after every live relational course can be
reconstructed and validated; an absent historical row is safer than a
fabricated release.
