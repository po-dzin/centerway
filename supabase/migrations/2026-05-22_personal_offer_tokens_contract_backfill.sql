-- CenterWay: backfill personal_offer_tokens to the full runtime contract.
-- Safe to run on environments where the table already exists in a partial form.

create table if not exists public.personal_offer_tokens (
  id bigserial primary key,
  token text not null unique,
  product_code text not null,
  offer_id text not null,
  status text not null default 'draft' check (status in ('draft', 'active', 'expired', 'consumed', 'cancelled')),
  recipient_key text,
  channel text,
  campaign text,
  amount integer not null check (amount > 0),
  old_amount integer check (old_amount is null or old_amount > 0),
  currency text not null default 'UAH',
  issued_at timestamptz,
  expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.personal_offer_tokens add column if not exists token text;
alter table public.personal_offer_tokens add column if not exists product_code text;
alter table public.personal_offer_tokens add column if not exists offer_id text;
alter table public.personal_offer_tokens add column if not exists status text;
alter table public.personal_offer_tokens add column if not exists recipient_key text;
alter table public.personal_offer_tokens add column if not exists channel text;
alter table public.personal_offer_tokens add column if not exists campaign text;
alter table public.personal_offer_tokens add column if not exists amount integer;
alter table public.personal_offer_tokens add column if not exists old_amount integer;
alter table public.personal_offer_tokens add column if not exists currency text;
alter table public.personal_offer_tokens add column if not exists issued_at timestamptz;
alter table public.personal_offer_tokens add column if not exists expires_at timestamptz;
alter table public.personal_offer_tokens add column if not exists metadata jsonb;
alter table public.personal_offer_tokens add column if not exists created_at timestamptz;

update public.personal_offer_tokens
set
  status = coalesce(nullif(status, ''), 'draft'),
  currency = coalesce(nullif(currency, ''), 'UAH'),
  metadata = coalesce(metadata, '{}'::jsonb),
  created_at = coalesce(created_at, now()),
  token = coalesce(nullif(token, ''), md5(random()::text || clock_timestamp()::text)),
  product_code = coalesce(nullif(product_code, ''), 'irem'),
  offer_id = coalesce(nullif(offer_id, ''), 'irem_launch_early_bird_2900'),
  amount = coalesce(amount, 2900);

alter table public.personal_offer_tokens alter column token set not null;
alter table public.personal_offer_tokens alter column product_code set not null;
alter table public.personal_offer_tokens alter column offer_id set not null;
alter table public.personal_offer_tokens alter column status set default 'draft';
alter table public.personal_offer_tokens alter column status set not null;
alter table public.personal_offer_tokens alter column amount set not null;
alter table public.personal_offer_tokens alter column currency set default 'UAH';
alter table public.personal_offer_tokens alter column currency set not null;
alter table public.personal_offer_tokens alter column issued_at drop not null;
alter table public.personal_offer_tokens alter column issued_at drop default;
alter table public.personal_offer_tokens alter column expires_at drop not null;
alter table public.personal_offer_tokens alter column expires_at drop default;
alter table public.personal_offer_tokens alter column metadata set default '{}'::jsonb;
alter table public.personal_offer_tokens alter column metadata set not null;
alter table public.personal_offer_tokens alter column created_at set default now();
alter table public.personal_offer_tokens alter column created_at set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'personal_offer_tokens_status_check'
      and conrelid = 'public.personal_offer_tokens'::regclass
  ) then
    alter table public.personal_offer_tokens
      add constraint personal_offer_tokens_status_check
      check (status in ('draft', 'active', 'expired', 'consumed', 'cancelled'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'personal_offer_tokens_amount_check'
      and conrelid = 'public.personal_offer_tokens'::regclass
  ) then
    alter table public.personal_offer_tokens
      add constraint personal_offer_tokens_amount_check
      check (amount > 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'personal_offer_tokens_old_amount_check'
      and conrelid = 'public.personal_offer_tokens'::regclass
  ) then
    alter table public.personal_offer_tokens
      add constraint personal_offer_tokens_old_amount_check
      check (old_amount is null or old_amount > 0);
  end if;
end
$$;

create unique index if not exists idx_personal_offer_tokens_token_unique
  on public.personal_offer_tokens (token);
create index if not exists idx_personal_offer_tokens_product_code
  on public.personal_offer_tokens (product_code);
create index if not exists idx_personal_offer_tokens_expires_at
  on public.personal_offer_tokens (expires_at);
create index if not exists idx_personal_offer_tokens_recipient_key
  on public.personal_offer_tokens (recipient_key);
create index if not exists idx_personal_offer_tokens_recipient_campaign_created_at
  on public.personal_offer_tokens (recipient_key, campaign, created_at desc);

alter table public.personal_offer_tokens enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'personal_offer_tokens'
      and policyname = 'Admins and Support can view personal_offer_tokens'
  ) then
    execute $p$
      create policy "Admins and Support can view personal_offer_tokens"
      on public.personal_offer_tokens
      for select
      using (public.get_my_role() in ('admin', 'support'))
    $p$;
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'personal_offer_tokens'
      and policyname = 'Admins can manage personal_offer_tokens'
  ) then
    execute $p$
      create policy "Admins can manage personal_offer_tokens"
      on public.personal_offer_tokens
      for all
      using (public.get_my_role() = 'admin')
    $p$;
  end if;
end
$$;
