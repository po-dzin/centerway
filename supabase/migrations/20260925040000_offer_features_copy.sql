-- offer_features_copy: формулировки форматов Шляху 21 без «всі 21 день»
-- 25.09.2026
--
-- ЗАЧЕМ. Пункты повторяли длительность («на всі 21 день», «усі 21 день»),
-- которую страница уже называет в бейдже; владелец попросил говорить «протягом
-- курсу». Группа получает пункт о самих участниках потока — ради этого её и
-- выбирают. Только данные; правится дальше в билдере.
--
-- ОТКАТ: предыдущие списки — в 20260925030000_offer_features.sql.

begin;

update public.experience_offers set features = jsonb_build_object('uk', jsonb_build_array(
  'Покрокові інструкції на кожен день курсу',
  'Харчування й режим дня під вашу конституцію',
  '3 фітозбори (за потреби — аюрведичні аналоги)',
  'Процедурний блок: тіло, дихання, тепло',
  '3 вебінари, відеоінструкції та рецепти',
  'Текстова підтримка протягом курсу'
), 'en', jsonb_build_array(
  'Step-by-step instructions for every day of the course',
  'Food and daily rhythm matched to your constitution',
  '3 herbal blends (Ayurvedic alternatives if needed)',
  'Procedures: body, breath, warmth',
  '3 webinars, video guides and recipes',
  'Text support throughout the course'
)) where code = 'course:way21';

update public.experience_offers set features = jsonb_build_object('uk', jsonb_build_array(
  'Усе з формату «Самостійно»',
  'Спільне проходження: потік стартує разом і йде день у день',
  'Закрита Telegram-група потоку',
  'Відповіді на питання в групі протягом курсу',
  'Досвід і підтримка учасників поруч'
), 'en', jsonb_build_array(
  'Everything in the self-paced format',
  'Together: the cohort starts on one day and moves day by day',
  'A private Telegram group for the cohort',
  'Questions answered in the group throughout the course',
  'The experience and support of the people beside you'
)) where code = 'way21-group';

update public.experience_offers set features = jsonb_build_object('uk', jsonb_build_array(
  'Усе з формату «Самостійно»',
  '2 консультації з автором: діагностика доші на старті й розбір у фіналі',
  'Персональний протокол під вашу конституцію',
  'Корекція харчування, зборів і процедур по ходу',
  'Прямий зв''язок з автором у Telegram протягом курсу'
), 'en', jsonb_build_array(
  'Everything in the self-paced format',
  '2 consultations with the author: dosha diagnostics at the start, review at the end',
  'A personal protocol for your constitution',
  'Food, herbs and procedures adjusted as you go',
  'Direct Telegram contact with the author throughout the course'
)) where code = 'way21-support';

commit;
