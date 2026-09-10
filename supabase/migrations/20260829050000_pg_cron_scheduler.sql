-- CenterWay: scheduling moves from Vercel to the database.
--
-- APPLIED 2026-08-29 to production over the session pooler. Verified after:
-- both extensions present (pg_cron 1.6.4 in pg_catalog, pg_net 0.19.5 with its
-- functions in `net`), all seven jobs in `cron.job` and active, and the whole
-- chain proved end to end — `cron_call_endpoint('/api/cron/process-jobs')`
-- returned 200 `{"success":true,"processedCount":0}`, which is only reachable
-- AFTER requireCronAuth accepts the bearer, so the Vault secret is the right
-- one. The Vault values were checked against the Vercel env by sha256 (equal)
-- without either being printed.
--
-- vercel.json now carries `"crons": []` rather than being deleted: an explicit
-- empty list says "this project deliberately schedules nothing here", which a
-- missing file does not. The schedules live in `cron.job`; that is the only
-- place to change them now.
-- Contract: src/lib/cron/auth.ts (Bearer CRON_SECRET), vercel.json
--
-- ─── WHY ────────────────────────────────────────────────────────────────────
--
-- Vercel's Hobby plan allows DAILY cron only, and one of these jobs is not a
-- daily job. `process-jobs` drains the queue that carries Meta Purchase events,
-- Telegram sale reports and reminders; its worker is written around a 5 / 25 /
-- 125 MINUTE backoff and gives up after three attempts. On a once-a-day trigger
-- that backoff never happens as designed — three attempts take three days, and
-- a transient Meta 500 becomes a permanently `failed` row.
--
-- pg_cron has no such limit. Minute granularity, no plan tier, and the schedule
-- lives next to the data it serves.
--
-- ─── WHY THIS NEEDS NO APPLICATION CHANGES ──────────────────────────────────
--
-- The endpoints already authenticate with a plain `Authorization: Bearer
-- <CRON_SECRET>` (src/lib/cron/auth.ts) rather than with Vercel's own
-- `x-vercel-cron` signal. So any caller holding the secret is a valid caller,
-- and Postgres becomes one without a line of TypeScript changing. Vercel's cron
-- was never load-bearing for authentication — only for timing.
--
-- ─── THE SECRET DOES NOT GO IN THE CRON COMMAND ─────────────────────────────
--
-- `cron.job.command` is readable by anyone who can read the table, and a
-- scheduler row is not a place to keep a bearer token. Both values live in
-- Vault and are read at fire time. Create them ONCE, by hand, before running
-- this file (SQL editor, not checked in anywhere):
--
--   select vault.create_secret('<the CRON_SECRET value>', 'cron_secret');
--   select vault.create_secret('https://www.centerway.net.ua', 'cron_base_url');
--
-- Rotating CRON_SECRET later means updating the Vault secret AND the Vercel env
-- var. They are two copies of one fact; that is the price of the app and the
-- scheduler being different machines.

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ─── One caller, so the secret is read in one place ─────────────────────────
--
-- SECURITY DEFINER: the schedule runs as the cron owner, and the point of this
-- wrapper is that reading the Vault secret is NOT a capability the caller needs
-- to hold — it needs to happen inside a function nobody else may execute.
--
-- pg_net is asynchronous by design: this returns a request id immediately and
-- does not wait for the endpoint. That is correct here and worth stating,
-- because it means A CRON RUN SUCCEEDING PROVES ONLY THAT THE REQUEST WAS
-- QUEUED. Whether the endpoint answered 200 is in net._http_response, which the
-- observability query at the bottom reads.
CREATE OR REPLACE FUNCTION public.cron_call_endpoint(path text)
RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  base   text;
  secret text;
BEGIN
  SELECT decrypted_secret INTO base
    FROM vault.decrypted_secrets WHERE name = 'cron_base_url';
  SELECT decrypted_secret INTO secret
    FROM vault.decrypted_secrets WHERE name = 'cron_secret';

  IF base IS NULL OR secret IS NULL THEN
    -- Loud, not silent. A scheduler that quietly stops calling anything is the
    -- failure mode this whole change is meant to remove, not introduce.
    RAISE EXCEPTION 'cron_call_endpoint: vault secrets cron_base_url/cron_secret are not set';
  END IF;

  RETURN net.http_get(
    url     := base || path,
    headers := jsonb_build_object('Authorization', 'Bearer ' || secret),
    -- Longer than a fast endpoint needs and shorter than the function's own
    -- ceiling: process-jobs can legitimately spend a while draining a backlog.
    timeout_milliseconds := 60000
  );
END;
$$;

REVOKE ALL ON FUNCTION public.cron_call_endpoint(text) FROM PUBLIC, anon, authenticated;

-- ─── The schedules ──────────────────────────────────────────────────────────
--
-- Unschedule first so this file is safe to re-run: cron.schedule on an existing
-- name updates it, but being explicit keeps a rename from leaving an orphan
-- firing forever.
SELECT cron.unschedule(jobname)
FROM cron.job
WHERE jobname IN (
  'cw-process-jobs', 'cw-jobs-reaper', 'cw-lms-reminders',
  'cw-dosha-reminders', 'cw-refresh-analytics', 'cw-sync-meta', 'cw-analytics-reports'
);

-- THE ONE THAT MOTIVATED THIS. Five minutes, so the worker's own 5/25/125
-- backoff means what it says.
SELECT cron.schedule('cw-process-jobs', '*/5 * * * *',
  $job$ SELECT public.cron_call_endpoint('/api/cron/process-jobs'); $job$);

-- Everything else keeps the cadence it had under Vercel. Moving the trigger is
-- not an invitation to re-tune what these jobs do; times are UTC, as before.
SELECT cron.schedule('cw-lms-reminders',     '0 6 * * *',
  $job$ SELECT public.cron_call_endpoint('/api/cron/lms-reminders'); $job$);
SELECT cron.schedule('cw-dosha-reminders',   '30 6 * * *',
  $job$ SELECT public.cron_call_endpoint('/api/cron/dosha-reminders'); $job$);
SELECT cron.schedule('cw-refresh-analytics', '30 3 * * *',
  $job$ SELECT public.cron_call_endpoint('/api/cron/refresh-analytics'); $job$);
SELECT cron.schedule('cw-sync-meta',         '0 2 * * *',
  $job$ SELECT public.cron_call_endpoint('/api/cron/sync-meta'); $job$);
SELECT cron.schedule('cw-analytics-reports', '15 4 * * *',
  $job$ SELECT public.cron_call_endpoint('/api/cron/analytics-reports'); $job$);

-- ─── The reaper, which Vercel could never have run ──────────────────────────
--
-- `processPendingJobs` marks a batch `running` BEFORE working it. If the
-- function is killed mid-batch — timeout, deploy, cold-start eviction — those
-- rows stay `running` and are never picked up again, because the worker selects
-- only `pending`/`failed`. This has already happened once; the evidence is
-- docs/migration/sql/2026-06-10_reset_stuck_running_jobs.sql, which was a
-- MANUAL cleanup of exactly this.
--
-- 15 minutes is comfortably longer than the 60s call above can take, so a job
-- still legitimately in flight is never stolen back.
--
-- `attempts` is NOT incremented: the job was never tried, it was interrupted.
-- Charging it an attempt would let three deploys retire a job that no code ever
-- ran, which is the opposite of what a reaper is for.
SELECT cron.schedule('cw-jobs-reaper', '*/15 * * * *', $job$
  UPDATE public.jobs
     SET status = 'pending'
   WHERE status = 'running'
     AND updated_at < now() - interval '15 minutes';
$job$);

-- ─── After running: what to look at ─────────────────────────────────────────
--
-- Scheduled:
--   SELECT jobname, schedule, active FROM cron.job ORDER BY jobname;
--
-- Did the runs fire, and did the endpoint actually answer? Two questions, two
-- tables — see the note on pg_net being asynchronous above.
--   SELECT j.jobname, r.status, r.return_message, r.start_time
--     FROM cron.job_run_details r JOIN cron.job j USING (jobid)
--    WHERE r.start_time > now() - interval '1 hour'
--    ORDER BY r.start_time DESC;
--
--   SELECT id, status_code, error_msg, created
--     FROM net._http_response
--    WHERE created > now() - interval '1 hour'
--    ORDER BY created DESC;
--
-- ─── ORDERING, WHICH IS THE ONLY RISK HERE ──────────────────────────────────
--
-- Run this BEFORE removing `crons` from vercel.json and both fire for a while.
-- That is safe and is the recommended order: every one of these endpoints is
-- already idempotent (the worker claims rows by flipping status; the reporting
-- and CAPI jobs dedupe on order_ref), so a double trigger does the work once.
-- Remove the vercel.json block on the next deploy and the overlap ends.
--
-- The reverse order — vercel.json first — leaves the queue with NO scheduler
-- between the deploy and this file being run. Do not do that.
--
-- WHAT HAPPENED: this file ran first, then `crons` was emptied in the same
-- working tree. Until that empty list is DEPLOYED, Vercel still holds the old
-- daily schedule and both schedulers fire — which is the safe overlap above,
-- not a fault. Nothing needs doing about it beyond deploying.
