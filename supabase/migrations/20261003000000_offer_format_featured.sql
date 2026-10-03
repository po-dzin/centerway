-- 2026-10-03 · «Бестселер» on one format of a program, marked by the owner
--
-- A program sold in formats shows them side by side, and the button contract
-- allows one primary action per view. Which format carries it — the gold
-- «Бестселер» pill and the only gold button — is the OWNER'S call, made in the
-- builder (G, 2026-10-03), like the price: a claim about what sells is not
-- computed from a handful of orders. Without a mark, every format's button is
-- secondary.
--
-- At most one marked format per program: a partial unique index on the
-- program's experience, so two gold buttons in one row cannot be stored.
--
-- ROLLBACK:
--   drop index if exists public.experience_offers_one_featured;
--   alter table public.experience_offers drop column featured;

alter table public.experience_offers
  add column if not exists featured boolean not null default false;

create unique index if not exists experience_offers_one_featured
  on public.experience_offers (experience_id)
  where featured;

comment on column public.experience_offers.featured is
  'Owner-marked «Бестселер» format of its program: the gold pill and the only primary button. At most one per experience.';
