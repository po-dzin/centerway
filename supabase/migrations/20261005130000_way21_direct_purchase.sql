-- Way21 self and group are directly purchasable; only individual support uses an enquiry.
-- Preserve prices, early-price dates and the already configured access rules.
update public.experience_offers o
set mode = 'checkout'
from public.lms_courses c
where c.slug = 'way21'
  and c.experience_id = o.experience_id
  and o.code in ('course:way21', 'way21-group')
  and o.amount > 0
  and (o.access_lifetime or o.access_days > 0)
  and o.mode = 'lead';
