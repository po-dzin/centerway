-- CenterWay: what people actually ask, kept as a corpus rather than as a log.
--
-- WHY IT EXISTS
-- `docs/agent-contour-2026-08-21.md` §4A named this as the last missing
-- preparatory piece: the assistant's quality is unmeasurable without a set of
-- real questions to measure it against. The platform has exactly seven — the
-- support bot's own FAQ topics — and they are the questions we already knew.
-- Every other question people have asked went to a Telegram thread and stayed
-- there, unqueryable, or hit the bot's fallback and was discarded outright.
--
-- WHAT IS STORED, AND WHAT DELIBERATELY IS NOT
-- The text of the question, redacted before it is written (see
-- `src/lib/agent/questions/redact.ts`), and the surface it came from. NOT
-- stored: telegram id, username, account id, contact, thread reference, IP.
-- There is no column to put them in, which is the point — a corpus row cannot
-- be walked back to a person, and the identifiable conversation continues to
-- live in Telegram where a human is answering it.
--
-- That is also what makes this defensible under the privacy policy without a
-- new consent: what is kept is not personal data about a customer, it is a
-- sentence about a product with the person removed at the door.
--
-- NO DEDUPLICATION, ON PURPOSE
-- The same question asked forty times is the single most useful fact this table
-- can hold. Frequency is the signal; a unique index would delete it.
--
-- THE LABELS ARE FOR HUMANS
-- `expected_doc_id` and `topic` are filled in by a person reading the corpus,
-- not by anything automatic. A retrieval evaluated against labels that
-- retrieval produced measures nothing.
--
-- Safe to re-run.

CREATE TABLE IF NOT EXISTS public.agent_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- The question, after redaction. Never the raw text.
  text text NOT NULL CHECK (length(text) BETWEEN 12 AND 2000),
  -- Where it was asked.
  --   bot_fallback — free text the support bot could not route. The most
  --     valuable source in the table: these are questions nothing answers.
  --   bot_support  — a message deliberately addressed to a human.
  --   assistant    — asked of A2 itself, once it exists.
  source text NOT NULL CHECK (source IN ('bot_fallback', 'bot_support', 'assistant')),
  -- Which kinds of personal data were removed, e.g. {email,number}. The kinds,
  -- never the values — enough to audit the redactor's reach without holding
  -- what it caught.
  redacted text[] NOT NULL DEFAULT '{}',
  -- Filled in by a person: which corpus document SHOULD answer this, and a
  -- coarse topic. NULL means "not yet labelled", which is the normal state.
  expected_doc_id text NULL,
  topic text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- The two queries this table exists for: "what came in lately" and "what is
-- still unlabelled".
CREATE INDEX IF NOT EXISTS idx_agent_questions_created
  ON public.agent_questions (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_questions_unlabelled
  ON public.agent_questions (created_at DESC)
  WHERE expected_doc_id IS NULL;

ALTER TABLE public.agent_questions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- Staff only, and read-only even for them. Nobody's own questions are
  -- readable back to them because nothing records whose they were: there is no
  -- "own row" to grant. Writes come from the service role alone.
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'agent_questions' AND policyname = 'Staff can read the question corpus'
  ) THEN
    EXECUTE $p$ CREATE POLICY "Staff can read the question corpus" ON public.agent_questions
      FOR SELECT USING (public.get_my_role() in ('admin', 'support')) $p$;
  END IF;

  -- Labelling is staff work and happens in the database or through an admin
  -- tool, so an update policy exists where an insert policy deliberately does
  -- not: a person may say what the right answer was, and may not invent a
  -- question that nobody asked.
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'agent_questions' AND policyname = 'Staff can label the question corpus'
  ) THEN
    EXECUTE $p$ CREATE POLICY "Staff can label the question corpus" ON public.agent_questions
      FOR UPDATE USING (public.get_my_role() in ('admin', 'support'))
      WITH CHECK (public.get_my_role() in ('admin', 'support')) $p$;
  END IF;
END $$;
