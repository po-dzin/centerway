-- CenterWay: broadcasts — record the consent a public form collects.
--
-- Contract: src/lib/broadcasts/subscribe.ts, src/app/api/subscribe/route.ts,
--           src/components/platform/SubscribeForm.tsx
-- Doc:      docs/broadcasts-2026-09-15.md
--
-- WHY. Until now every row in `messaging_subscriptions` arrived from an import,
-- the admin panel, an unsubscribe link or a provider webhook — none of them a
-- person ticking a box. The public subscribe form is the first door where the
-- person themself says yes, and that yes is the one thing worth being able to
-- show later: when it was given, on which form, and from which campaign.
--
-- `source` already says where the ROW came from, and it keeps saying that: it is
-- written once, on insert. Consent is different — a person who unsubscribed and
-- comes back through the form gives it again — so it gets its own columns, and
-- they are overwritten each time it is given:
--
--   consented_at     when the person last gave explicit consent through a form.
--                    NULL for imported and manual rows: an import is not consent
--                    the platform witnessed.
--   consent_source   which form (its placement id, e.g. 'footer').
--   attribution      {ref, utm} read from the first-party cookies at that moment.
--
-- The route writes these and, on a database that does not have them yet, falls
-- back to writing the row without them — so deploying the code before this
-- migration loses the record of consent, never the subscription itself.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS, safe to re-run. No data is changed.
--
-- ROLLBACK:
--   alter table public.messaging_subscriptions
--     drop column if exists consented_at,
--     drop column if exists consent_source,
--     drop column if exists attribution;

ALTER TABLE public.messaging_subscriptions
  ADD COLUMN IF NOT EXISTS consented_at timestamptz,
  ADD COLUMN IF NOT EXISTS consent_source text,
  ADD COLUMN IF NOT EXISTS attribution jsonb;

COMMENT ON COLUMN public.messaging_subscriptions.consented_at IS
  'When the person last gave explicit consent through a public form. NULL for imported/manual rows.';
COMMENT ON COLUMN public.messaging_subscriptions.consent_source IS
  'Placement id of the form that collected the latest consent (e.g. footer).';
COMMENT ON COLUMN public.messaging_subscriptions.attribution IS
  'First-party attribution at the latest consent: {"ref": text|null, "utm": {source, medium, ...}|null}.';
