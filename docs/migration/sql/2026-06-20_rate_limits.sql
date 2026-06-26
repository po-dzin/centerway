-- CenterWay: Global rate limiting for public APIs (P0-A)
-- Goal: atomic, instance-shared rate limiting without new infra (Postgres-backed).
-- Used by src/lib/rateLimit.ts on public endpoints (/api/events, /api/pay/start, ...).
-- Safety rules:
-- 1) Additive only; re-runnable.
-- 2) Fixed-window counter, single round-trip, atomic via upsert.
-- 3) Service-role writes only; RLS denies anon by default.

begin;

-- ---------------------------------------------
-- A) Counter table (fixed-window buckets)
-- ---------------------------------------------
create table if not exists public.rate_limits (
  key text not null,
  window_start timestamptz not null,
  count integer not null default 0,
  primary key (key, window_start)
);

create index if not exists idx_rate_limits_window_start on public.rate_limits (window_start);

-- Lock down: only service role / admin touch this table.
alter table public.rate_limits enable row level security;
-- (no anon policies => anon has no access; service role bypasses RLS)

-- ---------------------------------------------
-- B) Atomic check-and-increment
--    Returns allowed flag, current count in window, and retry_after seconds.
-- ---------------------------------------------
create or replace function public.check_rate_limit(
  p_key text,
  p_max integer,
  p_window_seconds integer
)
returns table(allowed boolean, current_count integer, retry_after integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window_start timestamptz;
  v_count integer;
begin
  -- align to fixed bucket boundary
  v_window_start := to_timestamp(
    floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds
  );

  insert into public.rate_limits as rl (key, window_start, count)
  values (p_key, v_window_start, 1)
  on conflict (key, window_start)
  do update set count = rl.count + 1
  returning rl.count into v_count;

  allowed := v_count <= p_max;
  current_count := v_count;
  retry_after := case
    when v_count <= p_max then 0
    else ceil(extract(epoch from (
      v_window_start + make_interval(secs => p_window_seconds) - now()
    )))::int
  end;

  -- opportunistic prune of old buckets (~1% of calls) to bound table growth
  if random() < 0.01 then
    delete from public.rate_limits
    where window_start < now() - interval '1 hour';
  end if;

  return next;
end;
$$;

commit;

-- ---------------------------------------------
-- Verification (manual):
--   select * from public.check_rate_limit('test:1.2.3.4', 3, 60);  -- run >3x, expect allowed=false
-- ---------------------------------------------
