-- Prevent new duplicate customers by contact fields.
-- Run once in Supabase SQL editor (safe to re-run).

create unique index if not exists customers_email_unique_idx
  on public.customers (lower(email))
  where email is not null and btrim(email) <> '';

create unique index if not exists customers_phone_unique_idx
  on public.customers (phone)
  where phone is not null and btrim(phone) <> '';

