-- LMS: allow a completed lesson to be un-completed.
--
-- Why: completion was strictly monotonic, which contradicts the product. The
-- reset-day protocol is explicitly repeatable ("повторюй тоді, коли відчуваєш
-- потребу"), and a course whose steps can never be un-ticked can never be taken
-- a second time — the learner finishes once and the surface is permanently done.
--
-- Un-completing is a new EVENT, not a delete: the log stays append-only, so the
-- offline replay story (H4) still converges by folding rather than merging.
-- See src/lms-core/progress.ts.
--
-- Safe to re-run. Widening a CHECK constraint accepts every row that already
-- exists, so there is no backfill and no data migration.

ALTER TABLE public.lms_progress_events
  DROP CONSTRAINT IF EXISTS lms_progress_events_type_check;

ALTER TABLE public.lms_progress_events
  ADD CONSTRAINT lms_progress_events_type_check
  CHECK (type IN ('lesson.started', 'lesson.completed', 'lesson.uncompleted', 'checklist.toggled'));
