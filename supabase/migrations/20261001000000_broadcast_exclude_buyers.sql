-- CenterWay: broadcasts — leave out who already bought.
--
-- Contract: src/lib/broadcasts/audience.ts (`exclude_buyers`), docs/broadcasts-2026-09-15.md
--
-- WHY. The group launch on 2026-11-01 is announced to everyone who bought
-- anything, and reminded twice. Without this, the person who paid for the
-- group after the first letter gets «ще є місця» twice more. The rule gains
-- one list, `exclude_buyers` (product codes); everything else is the function
-- from 20260915000000_broadcasts.sql, unchanged. An audience without the key
-- behaves exactly as before, and the code sends the key harmlessly to a
-- database that does not have this yet (the old function ignores it).
--
-- Idempotent: CREATE OR REPLACE, same signature, grants kept.

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
    )
    -- New: whoever already paid for one of these products is left out, matched
    -- by the order's customer address — "do not invite the people who came".
    AND NOT EXISTS (
      SELECT 1
      FROM public.orders o
      JOIN public.customers c ON c.id = o.customer_id
      WHERE o.status = 'paid'
        AND lower(btrim(c.email)) = d.address
        AND o.product_code IN (
          SELECT jsonb_array_elements_text(coalesce(p_audience->'exclude_buyers', '[]'::jsonb))
        )
    );
$$;

REVOKE ALL ON FUNCTION public.broadcast_audience(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.broadcast_audience(jsonb) TO service_role;
