-- Автовідповіді (Instagram, крок 1): правила «слово в коментарі → відповідь у директ»
-- і журнал подій. Вкладка «Автовідповіді» в адмінці «Розсилки».
--
-- Idempotent throughout: safe to re-run. Nothing here is read by the browser:
-- RLS is on and there are no policies, so only the service role (the webhook and
-- the admin API) touches these tables.

CREATE TABLE IF NOT EXISTS public.autoreply_rules (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL DEFAULT '',
  channel text NOT NULL DEFAULT 'instagram',
  -- The Instagram media the rule watches; NULL = every post of the account.
  media_id text,
  -- Lowercased words; a comment matches when it contains any of them.
  keywords text[] NOT NULL DEFAULT '{}',
  -- Public replies under the comment, one picked at random. May be empty.
  public_replies text[] NOT NULL DEFAULT '{}',
  -- Direct messages, one picked at random. At least one.
  dm_texts text[] NOT NULL DEFAULT '{}',
  button_label text,
  button_url text,
  utm_campaign text,
  -- A new rule is OFF: nothing is sent until the owner turns it on.
  enabled boolean NOT NULL DEFAULT false,
  max_per_hour integer NOT NULL DEFAULT 200,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT autoreply_rules_channel_check CHECK (channel IN ('instagram')),
  CONSTRAINT autoreply_rules_public_replies_check CHECK (cardinality(public_replies) <= 5),
  CONSTRAINT autoreply_rules_dm_texts_check CHECK (cardinality(dm_texts) <= 5),
  CONSTRAINT autoreply_rules_max_per_hour_check CHECK (max_per_hour BETWEEN 1 AND 750)
);

CREATE INDEX IF NOT EXISTS autoreply_rules_enabled_idx ON public.autoreply_rules (channel, enabled);

ALTER TABLE public.autoreply_rules ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.autoreply_events (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  rule_id uuid NOT NULL REFERENCES public.autoreply_rules(id) ON DELETE CASCADE,
  -- Instagram's comment id. UNIQUE, so a webhook that Meta delivers twice is
  -- processed once: the second insert is the "already handled" answer.
  comment_id text NOT NULL,
  ig_user_id text,
  ig_username text,
  -- pending → sent | failed, or skipped_* when a guard stopped it.
  status text NOT NULL DEFAULT 'pending',
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT autoreply_events_comment_key UNIQUE (comment_id),
  CONSTRAINT autoreply_events_status_check CHECK (
    status IN ('pending', 'sent', 'failed', 'skipped_duplicate', 'skipped_old', 'skipped_rate')
  )
);

CREATE INDEX IF NOT EXISTS autoreply_events_rule_created_idx ON public.autoreply_events (rule_id, created_at DESC);

-- One message per person per rule: a second `sent` for the same account cannot exist.
CREATE UNIQUE INDEX IF NOT EXISTS autoreply_events_once_per_person_idx
  ON public.autoreply_events (rule_id, ig_user_id)
  WHERE status = 'sent' AND ig_user_id IS NOT NULL;

ALTER TABLE public.autoreply_events ENABLE ROW LEVEL SECURITY;
