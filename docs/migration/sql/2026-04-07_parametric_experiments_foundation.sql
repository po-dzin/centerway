-- CenterWay Parametric Platform v1
-- Foundation tables for feature flags and deterministic A/B assignments.

create extension if not exists pgcrypto;

create table if not exists public.feature_flags (
  id bigserial primary key,
  key text not null unique,
  description text,
  enabled boolean not null default false,
  rollout_percent integer not null default 0,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint feature_flags_rollout_percent_check check (rollout_percent >= 0 and rollout_percent <= 100)
);

create table if not exists public.experiments (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  version text not null,
  route_key text not null,
  status text not null default 'paused',
  default_variant_key text not null,
  started_at timestamptz,
  ended_at timestamptz,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint experiments_status_check check (status in ('active', 'paused', 'archived'))
);

create table if not exists public.experiment_variants (
  id uuid primary key default gen_random_uuid(),
  experiment_id uuid not null references public.experiments(id) on delete cascade,
  key text not null,
  weight numeric(8,2) not null,
  screen_manifest_id text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint experiment_variants_weight_check check (weight > 0),
  constraint experiment_variants_unique_key unique (experiment_id, key)
);

create table if not exists public.experiment_assignments (
  id bigserial primary key,
  experiment_key text not null,
  session_id text not null,
  variant_key text not null,
  assignment_source text,
  user_id uuid,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  last_event_name text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint experiment_assignments_unique_session unique (experiment_key, session_id),
  constraint experiment_assignments_source_check check (
    assignment_source is null or assignment_source in ('bucket', 'override', 'cookie', 'default')
  )
);

create index if not exists idx_experiments_route_status on public.experiments(route_key, status);
create index if not exists idx_experiment_variants_experiment_id on public.experiment_variants(experiment_id);
create index if not exists idx_experiment_assignments_session on public.experiment_assignments(session_id);
create index if not exists idx_experiment_assignments_last_seen on public.experiment_assignments(last_seen_at desc);
