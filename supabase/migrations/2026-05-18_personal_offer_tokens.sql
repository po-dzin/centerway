-- CenterWay: personal offer tokens for rolling 48-hour IREM outreach links.

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

create index if not exists idx_personal_offer_tokens_product_code on public.personal_offer_tokens (product_code);
create index if not exists idx_personal_offer_tokens_expires_at on public.personal_offer_tokens (expires_at);
create index if not exists idx_personal_offer_tokens_recipient_key on public.personal_offer_tokens (recipient_key);

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
