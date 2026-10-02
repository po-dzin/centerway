-- 2026-09-30 · «Бестселер» set by hand, «Новинка» by the date a thing first went on the shelf
--
-- A card on the storefront may carry one flag on its photograph, opposite the
-- kind badge. Two kinds, two sources:
--
--   bestseller — the OWNER'S claim, set in the admin catalogue. Not computed:
--     on the sales this platform has, «most sold in 90 days» would crown a
--     course for three orders, and a claim about sales is the owner's to make,
--     like the price (see the creator contract: price lives with the owner).
--   new — derived, never stored: a thing whose `first_listed_at` is under 30
--     days old. The code decides the window (src/lib/experiences/highlight.ts).
--
-- WHY `first_listed_at` AND NOT `created_at`. The registry was backfilled on
-- 2026-09-24, so every legacy course's row is four days old; «created» would
-- call way21 new. What a reader means by «new» is «new ON THE SHELF», so the
-- column records the first moment `listed` became true, stamped by a trigger
-- on the registry row — which the course sync already keeps in step with
-- `lms_courses` (experience_refresh). Things listed before this migration get
-- a date well in the past: they are not news.
--
-- ROLLBACK:
--   drop trigger experiences_first_listed on public.experiences;
--   drop function public.experiences_stamp_first_listed();
--   alter table public.experiences drop column highlight, drop column first_listed_at;

alter table public.experiences
  add column if not exists highlight text null,
  add column if not exists first_listed_at timestamptz null;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'experiences_highlight_known') then
    alter table public.experiences
      add constraint experiences_highlight_known check (highlight is null or highlight in ('bestseller'));
  end if;
end $$;

comment on column public.experiences.highlight is
  'Owner-set storefront flag; only ''bestseller'' today. «Новинка» is derived from first_listed_at, never stored.';
comment on column public.experiences.first_listed_at is
  'First time listed became true; stamped by experiences_first_listed. Drives the «Новинка» flag.';

update public.experiences
   set first_listed_at = timestamptz '2026-09-01 00:00:00+00'
 where listed and first_listed_at is null;

create or replace function public.experiences_stamp_first_listed()
returns trigger language plpgsql as $$
begin
  if new.listed and new.first_listed_at is null then
    new.first_listed_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists experiences_first_listed on public.experiences;
create trigger experiences_first_listed
  before insert or update of listed on public.experiences
  for each row execute function public.experiences_stamp_first_listed();
