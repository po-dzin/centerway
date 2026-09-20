-- A first open and a return are different facts. Until now both were written as
-- `lesson.started`, told apart only by a prefix inside `client_id`
-- (`srv:start:` vs `srv:open:`) — a string convention no counter can see. In
-- production 189 of 265 `lesson.started` rows were really returns (76 lessons
-- were genuinely begun), so every engagement number derived from that type was
-- inflated roughly 3.5x.
--
-- `lesson.opened` folds exactly like `lesson.started` (see src/lms-core/progress.ts):
-- it advances `lastActivityAt`, never un-completes, never re-stamps `startedAt`.
-- Nothing about current progress changes. Only counting gets an honest name.

ALTER TABLE public.lms_progress_events
  DROP CONSTRAINT IF EXISTS lms_progress_events_type_check;

ALTER TABLE public.lms_progress_events
  ADD CONSTRAINT lms_progress_events_type_check
  CHECK (type IN ('lesson.started', 'lesson.opened', 'lesson.completed', 'lesson.uncompleted', 'checklist.toggled'));

-- Backfill by POSITION, not by the `client_id` prefix. The prefix would be the
-- obvious key and it is the wrong one: the emitter has written `srv:open:` for
-- every visit for months, so the genuine first open of most lessons carries that
-- prefix too, and a prefix-keyed rewrite would erase the real starts. Measured
-- against production: 45 of the 76 genuine starts carry `srv:open:`.
-- The earliest `lesson.started` per (enrollment, lesson) is the start; the rest
-- are returns. `id` breaks ties because `occurred_at` is not a total order.
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY enrollment_id, lesson_id
                            ORDER BY occurred_at, id) AS rn
    FROM public.lms_progress_events
   WHERE type = 'lesson.started'
)
UPDATE public.lms_progress_events AS e
   SET type = 'lesson.opened'
  FROM ranked AS r
 WHERE e.id = r.id
   AND r.rn > 1;
