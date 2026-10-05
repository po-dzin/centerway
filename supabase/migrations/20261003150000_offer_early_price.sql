-- 2026-10-03 · Early price on a format: a lower price until a date
--
-- G approved the program page with an early price (artifact «Оптимізація 1»):
-- the price itself, the later one struck through above it, a quiet timer to
-- the date and one line «До 15 жовтня 3 400 ₴, далі 4 100 ₴». It is a fact of
-- the schedule, not a countdown that resets: the date is stored here, and
-- the page and the checkout read the same row.
--
-- `amount` stays the price AFTER the date. While `early_until` is ahead (the
-- early price holds until 00:00 Kyiv on that date) the checkout charges
-- `early_amount` instead — `src/lib/experiences/earlyPrice.ts`. Once the date
-- passes nothing has to be changed: the row simply reads as its `amount`.
--
-- Both or neither, and the early price is lower than the later one; a
-- «рання ціна» above the regular price would not be one.
--
-- ROLLBACK:
--   alter table public.experience_offers drop constraint if exists experience_offers_early_price_fits;
--   alter table public.experience_offers drop column early_until, drop column early_amount;

alter table public.experience_offers
  add column if not exists early_amount integer null,
  add column if not exists early_until date null;

alter table public.experience_offers
  drop constraint if exists experience_offers_early_price_fits;
alter table public.experience_offers
  add constraint experience_offers_early_price_fits check (
    (early_amount is null and early_until is null)
    or (early_amount is not null and early_until is not null and early_amount > 0
        and amount is not null and early_amount < amount)
  );

comment on column public.experience_offers.early_amount is
  'Early price, charged instead of amount until early_until (00:00 Kyiv). Lower than amount; set together with early_until.';
comment on column public.experience_offers.early_until is
  'The date the early price ends: from 00:00 Kyiv on this date the offer costs amount.';
