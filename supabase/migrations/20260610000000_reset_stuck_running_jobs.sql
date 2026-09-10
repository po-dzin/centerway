-- SQL migration: Reset stuck running jobs back to pending
-- Targets jobs stuck in 'running' status for more than 2 hours

UPDATE jobs
SET status = 'pending',
    attempts = 0,
    run_at = NOW(),
    error_text = 'Job timed out / reset from running status'
WHERE status = 'running'
  AND created_at < NOW() - INTERVAL '2 hours';
