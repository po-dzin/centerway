-- Meta Ads is now written to from the agent environment (scripts/meta/cli.mjs),
-- and a write nobody can read back later is how the ad account ended up with a
-- campaign nobody remembered starting. Every write — dry run or real — lands
-- here first: who, what, the exact request, the response, the error.
--
-- Reads never journal. There is no delete in the tool; the strongest action is
-- a pause, and it is one row like any other.

CREATE TABLE IF NOT EXISTS public.meta_actions (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at   timestamptz NOT NULL DEFAULT now(),
  actor        text NOT NULL,
  action       text NOT NULL,
  object_type  text,
  object_id    text,
  params       jsonb,
  dry_run      boolean NOT NULL DEFAULT true,
  response     jsonb,
  error        text
);

CREATE INDEX IF NOT EXISTS meta_actions_created_at_idx ON public.meta_actions (created_at DESC);
CREATE INDEX IF NOT EXISTS meta_actions_object_id_idx ON public.meta_actions (object_id);

ALTER TABLE public.meta_actions ENABLE ROW LEVEL SECURITY;
-- Service role only: no policies on purpose. The admin UI reads it through the
-- server, the CLI writes it with the service key.
REVOKE ALL ON public.meta_actions FROM anon, authenticated;
