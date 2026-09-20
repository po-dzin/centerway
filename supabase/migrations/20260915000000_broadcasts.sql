-- CenterWay: broadcasts — the platform's own mailing list, replacing SendPulse.
--
-- Contract: src/lib/broadcasts/*, src/app/api/admin/broadcasts/**,
--           src/app/api/unsubscribe/route.ts, src/app/api/resend/webhook/route.ts
-- Doc:      docs/broadcasts-2026-09-15.md
--
-- ─── WHY ────────────────────────────────────────────────────────────────────
--
-- Until today the base lived in SendPulse and nowhere else: a CSV imported by
-- hand in May, address books nobody could join to an order, and a
-- «відписався» that the platform never heard about. Three tables bring it home.
--
--   messaging_subscriptions  one row per (channel, address): the consent AND
--                            the suppression list. `status <> 'subscribed'`
--                            is never mailed, whatever audience asks for it.
--   broadcasts               one campaign: its words, its audience rule, its
--                            lifecycle.
--   broadcast_recipients     the audience frozen at the moment sending starts,
--                            one row per address, so a retry resumes instead of
--                            re-mailing and the stats have something to count.
--
-- `channel` already admits 'telegram'. The first release sends email only; the
-- column is there so the Telegram broadcast is a new sender, not a new schema.
--
-- ─── ACCESS ─────────────────────────────────────────────────────────────────
--
-- RLS on, no policies: only the service role reads or writes these, and the
-- authorization is `requireAdmin` in TypeScript (AGENTS.md → RLS is not the
-- application's guard). Functions are revoked from anon/authenticated.
--
-- Idempotent throughout: safe to re-run.

-- ─── Subscriptions / suppression ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.messaging_subscriptions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  channel text NOT NULL,
  -- Email: lowercased and trimmed (the CHECK below holds it). Telegram: chat id.
  address text NOT NULL,
  status text NOT NULL DEFAULT 'subscribed',
  -- Where the row came from: 'sendpulse_import', 'csv_import', 'manual', 'unsubscribe_link', 'resend_webhook'.
  source text NOT NULL DEFAULT 'manual',
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  name text,
  status_reason text,
  -- The campaign whose link or complaint changed the status, when there was one.
  status_broadcast_id uuid,
  status_changed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT messaging_subscriptions_channel_check CHECK (channel IN ('email', 'telegram')),
  CONSTRAINT messaging_subscriptions_status_check
    CHECK (status IN ('subscribed', 'unsubscribed', 'bounced', 'complained')),
  CONSTRAINT messaging_subscriptions_email_normalized_check
    CHECK (channel <> 'email' OR address = lower(btrim(address))),
  CONSTRAINT messaging_subscriptions_channel_address_key UNIQUE (channel, address)
);

CREATE INDEX IF NOT EXISTS messaging_subscriptions_channel_status_idx
  ON public.messaging_subscriptions (channel, status);

ALTER TABLE public.messaging_subscriptions ENABLE ROW LEVEL SECURITY;

-- The audience joins every source back to a customer by address.
CREATE INDEX IF NOT EXISTS customers_email_normalized_idx
  ON public.customers (lower(btrim(email)));

-- ─── Broadcasts ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.broadcasts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  channel text NOT NULL DEFAULT 'email',
  status text NOT NULL DEFAULT 'draft',
  -- Internal name, never shown to a recipient.
  title text NOT NULL DEFAULT '',
  subject text NOT NULL DEFAULT '',
  preheader text NOT NULL DEFAULT '',
  -- Light markup: paragraphs, `# heading`, `- list`, **bold**, [link](https://…), {{name}}.
  body text NOT NULL DEFAULT '',
  cta_label text,
  cta_url text,
  audience jsonb NOT NULL DEFAULT '{"include": []}'::jsonb,
  scheduled_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  recipients_total integer NOT NULL DEFAULT 0,
  sent_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  error_text text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT broadcasts_channel_check CHECK (channel IN ('email', 'telegram')),
  CONSTRAINT broadcasts_status_check
    CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'cancelled', 'failed'))
);

CREATE INDEX IF NOT EXISTS broadcasts_status_created_idx ON public.broadcasts (status, created_at DESC);

ALTER TABLE public.broadcasts ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.broadcast_recipients (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  broadcast_id uuid NOT NULL REFERENCES public.broadcasts(id) ON DELETE CASCADE,
  address text NOT NULL,
  name text,
  customer_id uuid,
  status text NOT NULL DEFAULT 'pending',
  claimed_at timestamptz,
  provider_id text,
  error_text text,
  sent_at timestamptz,
  delivered_at timestamptz,
  opened_at timestamptz,
  clicked_at timestamptz,
  bounced_at timestamptz,
  complained_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT broadcast_recipients_status_check
    CHECK (status IN ('pending', 'sending', 'sent', 'failed', 'skipped')),
  CONSTRAINT broadcast_recipients_broadcast_address_key UNIQUE (broadcast_id, address)
);

CREATE INDEX IF NOT EXISTS broadcast_recipients_broadcast_status_idx
  ON public.broadcast_recipients (broadcast_id, status);
CREATE INDEX IF NOT EXISTS broadcast_recipients_provider_id_idx
  ON public.broadcast_recipients (provider_id) WHERE provider_id IS NOT NULL;

ALTER TABLE public.broadcast_recipients ENABLE ROW LEVEL SECURITY;

-- ─── The audience ───────────────────────────────────────────────────────────
--
-- One definition, used by the live count in the editor and by the snapshot
-- taken when sending starts, so the number the owner confirms and the number
-- that goes out cannot come from two readings of the rule.
--
-- p_audience = {
--   "include": [                                  -- union of these
--     {"kind": "subscribers", "sources": [...]},   -- messaging_subscriptions, subscribed
--     {"kind": "buyers", "product_codes": [...]},  -- customers with a paid order
--     {"kind": "enrolled", "course_ids": [...]},   -- active LMS access
--     {"kind": "registered", "opted_in_only": bool},
--     {"kind": "leads", "product_codes": [...]},
--     {"kind": "tag", "tags": [...]}               -- customers.tags overlap
--   ],
--   "exclude_tags": [...]
-- }
-- An empty list inside a rule means "no filter on that field".
--
-- Suppression is applied LAST and unconditionally: an address that is
-- unsubscribed, bounced or complained is never returned, whichever source
-- produced it.

CREATE OR REPLACE FUNCTION public.broadcast_audience(p_audience jsonb)
RETURNS TABLE (address text, name text, customer_id uuid)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH rules AS (
    SELECT r AS rule, r->>'kind' AS kind
    FROM jsonb_array_elements(
      CASE WHEN jsonb_typeof(p_audience->'include') = 'array' THEN p_audience->'include' ELSE '[]'::jsonb END
    ) AS r
  ),
  candidates AS (
    SELECT lower(btrim(s.address)) AS address, s.name, s.customer_id
    FROM rules r
    JOIN public.messaging_subscriptions s ON s.channel = 'email' AND s.status = 'subscribed'
    WHERE r.kind = 'subscribers'
      AND (coalesce(jsonb_array_length(r.rule->'sources'), 0) = 0
           OR s.source IN (SELECT jsonb_array_elements_text(r.rule->'sources')))

    UNION ALL
    SELECT lower(btrim(c.email)), c.display_name, c.id
    FROM rules r
    JOIN public.orders o ON o.status = 'paid'
    JOIN public.customers c ON c.id = o.customer_id
    WHERE r.kind = 'buyers'
      AND (coalesce(jsonb_array_length(r.rule->'product_codes'), 0) = 0
           OR o.product_code IN (SELECT jsonb_array_elements_text(r.rule->'product_codes')))

    UNION ALL
    SELECT lower(btrim(pu.email)), pu.full_name, NULL::uuid
    FROM rules r
    JOIN public.lms_enrollments e
      ON e.status = 'active' AND e.revoked_at IS NULL AND (e.expires_at IS NULL OR e.expires_at > now())
    JOIN public.platform_users pu ON pu.auth_user_id = e.auth_user_id
    WHERE r.kind = 'enrolled'
      AND (coalesce(jsonb_array_length(r.rule->'course_ids'), 0) = 0
           OR e.course_id::text IN (SELECT jsonb_array_elements_text(r.rule->'course_ids')))

    UNION ALL
    SELECT lower(btrim(pu.email)), pu.full_name, NULL::uuid
    FROM rules r
    CROSS JOIN public.platform_users pu
    WHERE r.kind = 'registered'
      AND (coalesce((r.rule->>'opted_in_only')::boolean, false) = false OR pu.marketing_opt_in)

    UNION ALL
    SELECT lower(btrim(l.email)), l.name, NULL::uuid
    FROM rules r
    CROSS JOIN public.leads l
    WHERE r.kind = 'leads'
      AND (coalesce(jsonb_array_length(r.rule->'product_codes'), 0) = 0
           OR l.product_code IN (SELECT jsonb_array_elements_text(r.rule->'product_codes')))

    UNION ALL
    SELECT lower(btrim(c.email)), c.display_name, c.id
    FROM rules r
    JOIN public.customers c
      ON c.tags && ARRAY(SELECT jsonb_array_elements_text(coalesce(r.rule->'tags', '[]'::jsonb)))
    WHERE r.kind = 'tag'
  ),
  valid AS (
    SELECT * FROM candidates WHERE candidates.address ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  ),
  dedup AS (
    SELECT DISTINCT ON (v.address) v.address, v.name, v.customer_id
    FROM valid v
    ORDER BY v.address, (v.name IS NULL OR btrim(v.name) = ''), (v.customer_id IS NULL)
  )
  SELECT
    d.address,
    nullif(btrim(d.name), ''),
    coalesce(
      d.customer_id,
      (SELECT c.id FROM public.customers c WHERE lower(btrim(c.email)) = d.address ORDER BY c.created_at LIMIT 1)
    )
  FROM dedup d
  WHERE NOT EXISTS (
      SELECT 1 FROM public.messaging_subscriptions s
      WHERE s.channel = 'email' AND s.address = d.address AND s.status <> 'subscribed'
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.customers c
      WHERE lower(btrim(c.email)) = d.address
        AND c.tags && ARRAY(SELECT jsonb_array_elements_text(coalesce(p_audience->'exclude_tags', '[]'::jsonb)))
    );
$$;

CREATE OR REPLACE FUNCTION public.broadcast_audience_count(p_audience jsonb)
RETURNS integer
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT count(*)::integer FROM public.broadcast_audience(p_audience);
$$;

-- Freeze the audience into recipient rows. Re-runnable: an address already
-- frozen is left as it is, so a crashed start resumes rather than doubling.
CREATE OR REPLACE FUNCTION public.broadcast_materialize(p_broadcast_id uuid)
RETURNS integer
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_audience jsonb;
  v_total integer;
BEGIN
  SELECT b.audience INTO v_audience FROM public.broadcasts b WHERE b.id = p_broadcast_id;
  IF v_audience IS NULL THEN
    RAISE EXCEPTION 'broadcast_not_found';
  END IF;

  INSERT INTO public.broadcast_recipients (broadcast_id, address, name, customer_id)
  SELECT p_broadcast_id, a.address, a.name, a.customer_id
  FROM public.broadcast_audience(v_audience) a
  ON CONFLICT (broadcast_id, address) DO NOTHING;

  SELECT count(*)::integer INTO v_total FROM public.broadcast_recipients r WHERE r.broadcast_id = p_broadcast_id;
  UPDATE public.broadcasts SET recipients_total = v_total, updated_at = now() WHERE id = p_broadcast_id;
  RETURN v_total;
END;
$$;

-- Take the next batch to send. SKIP LOCKED so two workers never hold the same
-- row; a claim older than 15 minutes is a crashed worker and is taken again.
CREATE OR REPLACE FUNCTION public.broadcast_claim_recipients(p_broadcast_id uuid, p_limit integer)
RETURNS SETOF public.broadcast_recipients
LANGUAGE sql
SET search_path = public
AS $$
  UPDATE public.broadcast_recipients r
  SET status = 'sending', claimed_at = now()
  WHERE r.id IN (
    SELECT q.id FROM public.broadcast_recipients q
    WHERE q.broadcast_id = p_broadcast_id
      AND (q.status = 'pending' OR (q.status = 'sending' AND q.claimed_at < now() - interval '15 minutes'))
    ORDER BY q.created_at, q.id
    LIMIT greatest(1, least(p_limit, 100))
    FOR UPDATE SKIP LOCKED
  )
  RETURNING r.*;
$$;

-- Write a batch's outcome in one statement instead of a request per row, then
-- refresh the campaign's counters from the rows themselves.
-- p_results = [{"id": uuid, "status": "sent"|"failed"|"skipped", "provider_id": text, "error_text": text}]
CREATE OR REPLACE FUNCTION public.broadcast_mark_results(p_broadcast_id uuid, p_results jsonb)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  UPDATE public.broadcast_recipients r
  SET status = x.status,
      provider_id = coalesce(x.provider_id, r.provider_id),
      error_text = x.error_text,
      sent_at = CASE WHEN x.status = 'sent' THEN now() ELSE r.sent_at END
  FROM jsonb_to_recordset(p_results) AS x(id uuid, status text, provider_id text, error_text text)
  WHERE r.id = x.id AND r.broadcast_id = p_broadcast_id;

  UPDATE public.broadcasts b
  SET sent_count = (SELECT count(*) FROM public.broadcast_recipients r WHERE r.broadcast_id = b.id AND r.status = 'sent'),
      failed_count = (SELECT count(*) FROM public.broadcast_recipients r WHERE r.broadcast_id = b.id AND r.status = 'failed'),
      updated_at = now()
  WHERE b.id = p_broadcast_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.broadcast_stats(p_broadcast_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'total', count(*),
    'pending', count(*) FILTER (WHERE r.status IN ('pending', 'sending')),
    'sent', count(*) FILTER (WHERE r.status = 'sent'),
    'failed', count(*) FILTER (WHERE r.status = 'failed'),
    'skipped', count(*) FILTER (WHERE r.status = 'skipped'),
    'delivered', count(r.delivered_at),
    'opened', count(r.opened_at),
    'clicked', count(r.clicked_at),
    'bounced', count(r.bounced_at),
    'complained', count(r.complained_at),
    'unsubscribed', (
      SELECT count(*) FROM public.messaging_subscriptions s
      WHERE s.status_broadcast_id = p_broadcast_id AND s.status = 'unsubscribed'
    )
  )
  FROM public.broadcast_recipients r
  WHERE r.broadcast_id = p_broadcast_id;
$$;

-- Counts for the audience tab, in one round trip.
CREATE OR REPLACE FUNCTION public.messaging_subscription_counts()
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT coalesce(jsonb_object_agg(s.status, s.n), '{}'::jsonb)
  FROM (
    SELECT status, count(*) AS n FROM public.messaging_subscriptions WHERE channel = 'email' GROUP BY status
  ) s;
$$;

DO $$
DECLARE
  fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.broadcast_audience(jsonb)',
    'public.broadcast_audience_count(jsonb)',
    'public.broadcast_materialize(uuid)',
    'public.broadcast_claim_recipients(uuid, integer)',
    'public.broadcast_mark_results(uuid, jsonb)',
    'public.broadcast_stats(uuid)',
    'public.messaging_subscription_counts()'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn);
  END LOOP;
END;
$$;
