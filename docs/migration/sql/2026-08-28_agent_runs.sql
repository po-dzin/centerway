-- CenterWay: the agent contour's log — one row per session, one per turn.
--
-- WHY THIS EXISTS BEFORE THE AGENT DOES
-- `docs/agent-contour-2026-08-21.md` §6. An agent that may write the structure
-- of a course is obliged to leave a trace: when an author says "it wiped my
-- third module", the answer has to be a row, not a reconstruction. Course
-- revisions already give the UNDO (`lms_course_revisions`); they do not say who
-- asked for it or in which turn, and those are different questions.
--
-- The second use is the bill. Without `agent_runs` a token overrun is visible
-- only in the gateway's invoice, which is to say after it happened.
--
-- NOBODY WRITES THESE ROWS FROM A BROWSER
-- RLS is enabled and there is deliberately NO insert, update or delete policy:
-- the only writer is `src/lib/agent/runs.ts` holding the service role. A person
-- may read their own runs, staff may read all of them, and nothing in either
-- session can author a log entry — a log a caller can write is not a log.
--
-- A GUEST RUN HAS NO user_id. The assistant answers signed-out visitors too
-- (§4), and their runs are staff-visible only. That is also why the budget
-- query below is indexed on `user_id, started_at` rather than on `user_id`
-- alone: the daily spend of one person is a range scan on one account.
--
-- RETENTION: 90 days of message bodies, metadata kept. Not implemented as a
-- schedule here — Vercel Hobby allows one daily cron and the project already
-- spends it (`docs/…vercel-hobby`), so the trim belongs in the existing job
-- runner when the contour actually starts writing rows.
--
-- Safe to re-run.

CREATE TABLE IF NOT EXISTS public.agent_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Which of the two contours this was. `assistant` covers guest, learner and
  -- buyer alike: what differs between them is entitlement, not contour.
  contour text NOT NULL CHECK (contour IN ('builder', 'assistant')),
  -- NULL for a signed-out visitor talking to the assistant.
  user_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  -- The guest's budget key: sha256 of their address and a server secret, never
  -- the address itself. Without it a signed-out visitor would have no daily
  -- ceiling at all — `user_id` is NULL, so a per-account budget cannot see them
  -- — and the guest tier would be a number in a file that nothing enforces.
  -- Hashed because an IP is personal data and a spend log is not a place that
  -- needs to hold one; hashed WITH a secret so the table cannot be scanned for
  -- a known address.
  guest_key text NULL,
  -- What the session was pointed at, when it was pointed at anything.
  course_id uuid NULL REFERENCES public.lms_courses(id) ON DELETE SET NULL,
  -- The gateway string, e.g. "anthropic/claude-...". Recorded per run because
  -- the choice is per contour and will change under us.
  model text NULL,
  status text NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'completed', 'failed', 'refused', 'aborted')),
  input_tokens integer NOT NULL DEFAULT 0 CHECK (input_tokens >= 0),
  output_tokens integer NOT NULL DEFAULT 0 CHECK (output_tokens >= 0),
  -- The failure as the server saw it. Never the model's own words.
  error text NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz NULL
);

-- The budget question, and the only one asked on the hot path: "how much has
-- this account spent since midnight?"
CREATE INDEX IF NOT EXISTS idx_agent_runs_user_started
  ON public.agent_runs (user_id, started_at DESC);

-- The same question for a signed-out visitor.
CREATE INDEX IF NOT EXISTS idx_agent_runs_guest_started
  ON public.agent_runs (guest_key, started_at DESC)
  WHERE guest_key IS NOT NULL;

-- The same question asked project-wide.
CREATE INDEX IF NOT EXISTS idx_agent_runs_started
  ON public.agent_runs (started_at DESC);

CREATE TABLE IF NOT EXISTS public.agent_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.agent_runs(id) ON DELETE CASCADE,
  -- Turn order within the run. Explicit rather than inferred from a timestamp:
  -- two tool calls in the same millisecond are ordinary.
  seq integer NOT NULL CHECK (seq >= 0),
  role text NOT NULL CHECK (role IN ('user', 'assistant', 'tool')),
  -- Set for role = 'tool'. The NAME of the tool, from the closed registry —
  -- which is what makes "what did it actually do" answerable by a query rather
  -- than by reading prose.
  tool_name text NULL,
  -- Arguments as the server received them, after validation.
  tool_args jsonb NULL,
  -- The outcome code, e.g. 'ok', 'course_not_found', 'lms_builder_draft_conflict'.
  tool_result text NULL,
  -- The text of the turn. Trimmed by the retention pass; the row survives it.
  content text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- One turn per position. A retry that reuses a sequence number is a bug, and a
-- duplicated turn in a log is worse than a missing one.
CREATE UNIQUE INDEX IF NOT EXISTS uq_agent_messages_run_seq
  ON public.agent_messages (run_id, seq);

ALTER TABLE public.agent_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_messages ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'agent_runs' AND policyname = 'People can read their own agent runs'
  ) THEN
    EXECUTE $p$ CREATE POLICY "People can read their own agent runs" ON public.agent_runs
      FOR SELECT USING (user_id IS NOT NULL AND user_id = auth.uid()) $p$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'agent_runs' AND policyname = 'Staff can read agent runs'
  ) THEN
    EXECUTE $p$ CREATE POLICY "Staff can read agent runs" ON public.agent_runs
      FOR SELECT USING (public.get_my_role() in ('admin', 'support')) $p$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'agent_messages' AND policyname = 'People can read their own agent messages'
  ) THEN
    EXECUTE $p$ CREATE POLICY "People can read their own agent messages" ON public.agent_messages
      FOR SELECT USING (EXISTS (
        SELECT 1 FROM public.agent_runs r
        WHERE r.id = run_id AND r.user_id IS NOT NULL AND r.user_id = auth.uid()
      )) $p$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'agent_messages' AND policyname = 'Staff can read agent messages'
  ) THEN
    EXECUTE $p$ CREATE POLICY "Staff can read agent messages" ON public.agent_messages
      FOR SELECT USING (public.get_my_role() in ('admin', 'support')) $p$;
  END IF;
END $$;
