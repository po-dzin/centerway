-- offer_features: что человек получает в каждом формате
-- 25.09.2026
--
-- ЗАЧЕМ. Карточка формата говорила «Шлях 21 повністю» — одинаково для всех трёх
-- форматов, и разница между ними читалась только по цене. Лендинг программы
-- давно пишет её словами: консультації з автором, персональний протокол,
-- Telegram-група потоку. Теперь этот список — данные формата: автор правит его
-- в билдере, страница программы и лендинг читают одну строку.
--
-- ФОРМА. `features` — {uk: [..], en: [..]}, пункты по порядку. Состав набора
-- (Reset Day, Short) сюда НЕ пишется: он живёт в experience_offer_items и
-- показывается отдельной строкой «бонус», чтобы не разойтись с тем, что
-- реально откроется.
--
-- ОТКАТ: alter table public.experience_offers drop column features;

begin;

alter table public.experience_offers
  add column if not exists features jsonb null;

alter table public.experience_offers drop constraint if exists experience_offers_features_shape;
alter table public.experience_offers add constraint experience_offers_features_shape
  check (features is null or (jsonb_typeof(features) = 'object' and jsonb_typeof(coalesce(features -> 'uk', '[]'::jsonb)) = 'array'));

comment on column public.experience_offers.features is
  '{uk:[..],en:[..]} что входит в формат, по пунктам. Бонусные программы — в experience_offer_items, не здесь.';

update public.experience_offers set features = jsonb_build_object('uk', jsonb_build_array(
  'Покрокові інструкції на всі 21 день',
  'Харчування й режим дня під вашу конституцію',
  '3 фітозбори (за потреби — аюрведичні аналоги)',
  'Процедурний блок: тіло, дихання, тепло',
  '3 вебінари, відеоінструкції та рецепти',
  'Текстова підтримка 21 день'
), 'en', jsonb_build_array(
  'Step-by-step instructions for all 21 days',
  'Food and daily rhythm matched to your constitution',
  '3 herbal blends (Ayurvedic alternatives if needed)',
  'Procedures: body, breath, warmth',
  '3 webinars, video guides and recipes',
  'Text support for 21 days'
)) where code = 'course:way21' and features is null;

update public.experience_offers set features = jsonb_build_object('uk', jsonb_build_array(
  'Усе з формату «Самостійно»',
  'Спільне проходження: потік стартує разом і йде день у день',
  'Закрита Telegram-група потоку',
  'Відповіді на питання в групі всі 21 день'
), 'en', jsonb_build_array(
  'Everything in the self-paced format',
  'Together: the cohort starts on one day and moves day by day',
  'A private Telegram group for the cohort',
  'Questions answered in the group for all 21 days'
)) where code = 'way21-group' and features is null;

update public.experience_offers set features = jsonb_build_object('uk', jsonb_build_array(
  'Усе з формату «Самостійно»',
  '2 консультації з автором: діагностика доші на старті й розбір у фіналі',
  'Персональний протокол під вашу конституцію',
  'Корекція харчування, зборів і процедур по ходу',
  'Прямий зв''язок з автором у Telegram усі 21 день'
), 'en', jsonb_build_array(
  'Everything in the self-paced format',
  '2 consultations with the author: dosha diagnostics at the start, review at the end',
  'A personal protocol for your constitution',
  'Food, herbs and procedures adjusted as you go',
  'Direct Telegram contact with the author for all 21 days'
)) where code = 'way21-support' and features is null;

commit;
