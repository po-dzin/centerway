-- CenterWay: a daily watch on the storefront's own contents.
--
-- NOT APPLIED YET — run this in the SQL editor over the session pooler, the
-- same way 2026-08-29_pg_cron_scheduler.sql was applied. It adds ONE job and
-- changes nothing else; the wrapper it calls (`public.cron_call_endpoint`) and
-- both Vault secrets already exist from that file.
--
-- Contract: src/app/api/cron/shelf-check/route.ts, src/lib/lms/shelfHealth.ts
--
-- ─── WHY ────────────────────────────────────────────────────────────────────
--
-- `listLiveCourses` assembles every course from its rows and SKIPS any it
-- cannot, so one malformed course never empties the shelf for the others. The
-- skip is announced with a console.warn and nothing else.
--
-- On 2026-09-01 a tightened title ceiling made `reset-day` — published, listed,
-- priced, with learners in it — fail that assembly. It vanished from the
-- catalogue, from the rails and from the sitemap, while every column on the
-- admin screen still said «у продажу». It was found by a person noticing an
-- empty space two days later. That is the gap this job closes: the same audit,
-- run every morning, reporting into the support thread when — and only when —
-- something is actually wrong.
--
-- ─── THE HOUR ───────────────────────────────────────────────────────────────
--
-- 05:40 UTC, twenty minutes before `cw-lms-reminders`: the shelf is the thing a
-- morning visitor sees first, and finding it broken before the day's traffic is
-- the whole point. It also keeps the slot clear of the other jobs so a slow run
-- competes with nothing.

SELECT cron.unschedule(jobname) FROM cron.job WHERE jobname = 'cw-shelf-check';

SELECT cron.schedule('cw-shelf-check', '40 5 * * *',
  $job$ SELECT public.cron_call_endpoint('/api/cron/shelf-check'); $job$);

-- ─── After running ──────────────────────────────────────────────────────────
--
--   SELECT jobname, schedule, active FROM cron.job WHERE jobname = 'cw-shelf-check';
--
-- Prove the endpoint answers, rather than only that the request was queued —
-- pg_net is asynchronous, see the note in the 2026-08-29 file:
--
--   SELECT public.cron_call_endpoint('/api/cron/shelf-check');
--   SELECT id, status_code, error_msg, created
--     FROM net._http_response ORDER BY created DESC LIMIT 3;
--
-- A 200 with `"faults":[]` is the healthy answer. A non-empty `faults` array is
-- the alarm, and the same text will already be in the support thread.
