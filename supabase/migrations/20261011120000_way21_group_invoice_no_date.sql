-- The group stream's invoice text named a start date («Старт потоку 1 жовтня.»)
-- that had already moved to 2026-11-01. G chose not to tie the receipt text to
-- any date for now (2026-10-11), so the sentence is dropped, not rewritten: the
-- date a buyer sees comes from the stream date set in the builder.
--
-- Idempotent: only touches the row while the old sentence is still in it.
update public.experience_offers
set invoice_description = jsonb_build_object(
  'en', replace(invoice_description->>'en', ' The cohort starts on 1 October.', ''),
  'uk', replace(invoice_description->>'uk', ' Старт потоку 1 жовтня.', '')
)
where code = 'way21-group'
  and invoice_description->>'uk' like '%Старт потоку 1 жовтня.%';
