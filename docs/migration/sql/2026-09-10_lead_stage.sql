-- A lead had no state, so nothing could ever be finished with it.
--
-- `leads` recorded that somebody asked and nothing after that: no way to say
-- they had been called, no way to say the conversation ended. The journey map
-- named this as the blocker under every follow-up sequence — «без неё
-- последовательность не знает, когда остановиться» — because an automated
-- nudge with no notion of a closed lead is a machine that writes to people who
-- already bought, or already said no.
--
-- FOUR STAGES, DELIBERATELY. `new` and `in_progress` are open — a sequence may
-- speak. `won` and `lost` are closed — it must not. Splitting the closed half
-- in two costs nothing at write time and is the only way to read a conversion
-- rate off this table later; a single `closed` would have thrown that away.
--
-- The default is `new`, so every row that already exists becomes an open lead
-- rather than an untyped one. That is the honest reading: nobody has worked
-- them, because until now there was nowhere to record that they had.

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS stage text NOT NULL DEFAULT 'new';

ALTER TABLE public.leads
  DROP CONSTRAINT IF EXISTS leads_stage_check;

ALTER TABLE public.leads
  ADD CONSTRAINT leads_stage_check
  CHECK (stage IN ('new', 'in_progress', 'won', 'lost'));

-- When the stage last moved. NULL means it never has — the row is still sitting
-- at the default, which is a different fact from "someone looked and left it as
-- new", and the queue is sorted on it.
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS stage_changed_at timestamptz NULL;

-- The queue reads open leads oldest-first; without this it is a sequential scan
-- that grows with every form submission ever made.
CREATE INDEX IF NOT EXISTS idx_leads_stage_created_at
  ON public.leads (stage, created_at DESC);
