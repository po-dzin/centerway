-- CenterWay: Manual marketing inputs for unified analytics KPIs
-- Purpose: store reach/impressions/clicks/spend used for CPA/CPC/CTR/ROAS/ROI.
-- Safe for reruns.

begin;

create table if not exists public.analytics_marketing_inputs (
  id integer primary key check (id = 1),
  reach bigint not null default 0,
  impressions bigint not null default 0,
  clicks bigint not null default 0,
  spend numeric(14, 2) not null default 0,
  currency text not null default 'UAH',
  period_label text,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.analytics_marketing_inputs (id)
values (1)
on conflict (id) do nothing;

alter table public.analytics_marketing_inputs enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'analytics_marketing_inputs'
      and policyname = 'Admins and Support can view marketing inputs'
  ) then
    execute $p$
      create policy "Admins and Support can view marketing inputs"
        on public.analytics_marketing_inputs
        for select
        using (public.get_my_role() in ('admin', 'support'))
    $p$;
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'analytics_marketing_inputs'
      and policyname = 'Admins can manage marketing inputs'
  ) then
    execute $p$
      create policy "Admins can manage marketing inputs"
        on public.analytics_marketing_inputs
        for all
        using (public.get_my_role() = 'admin')
    $p$;
  end if;
end $$;

create index if not exists idx_analytics_marketing_inputs_updated_at
  on public.analytics_marketing_inputs (updated_at desc);

commit;
