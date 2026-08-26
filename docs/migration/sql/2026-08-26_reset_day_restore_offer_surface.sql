-- CenterWay: restore the Reset Day offer surface after a builder publish wiped it.
--
-- WHAT HAPPENED. 20260826010000 wrote the offer-surface copy (tagline, duration,
-- audience, results, format, access_note, author_note) and 20260826020000 set
-- visibility='listed'. Later the same day a publish from the builder serialized
-- a course object that predated those fields and overwrote the row — courseRows()
-- in src/lib/lms/authoring.ts writes `?? null` / `?? "hidden"` for every one of
-- them, so the course silently vanished from the home shelf and /programs.
--
-- The current authoring read path (readCourse) maps all of these columns back
-- into the course object, so a fresh builder load → publish now round-trips them
-- and this cannot recur from the same cause.
--
-- Idempotent: same values as 20260826010000/20260826020000, safe to re-run.

UPDATE public.lms_courses SET
  tagline = 'Вийти з кола «стрес → їжа → провина» за три дні',
  duration = '3 дні',
  access_note = 'доступ назавжди',

  audience = '["Заїдаєте стрес: емоції тягнуть до холодильника, навіть коли ви не голодні",
               "У харчуванні немає ритму — то переїдання, то пропущені прийоми",
               "Тіло важке, енергії немає, а настрій стрибає протягом дня",
               "Хочете почати з м''якого кроку, а не з жорсткої дієти"]'::jsonb,

  results = '["Спокій замість тривоги вже наприкінці дня",
              "Легкість у тілі й більше енергії",
              "Повертається смак до їжі, а провина після неї зникає",
              "Відчуття, що керуєте ви, а не їжа"]'::jsonb,

  format = '["Стратегія трьох днів — покроковий план, що і коли робити",
             "Чек-лист голодування, щоб пройти день без зривів",
             "Дихальна гімнастика, яка знімає тягу заїдати стрес",
             "Рецепти-солодощі без стрибків інсуліну",
             "Відео-інструкції на кожному кроці",
             "6 варіантів адаптації під ваш стан"]'::jsonb,

  author_note = 'Цей 3-денний формат я зібрав як найм''якший перший крок до здорових стосунків із їжею.',
  author_profile_id = COALESCE(author_profile_id,
    (SELECT id FROM public.lms_authors WHERE slug = 'yevhenii-koriakin')),
  visibility = 'listed',
  updated_at = now()
WHERE slug = 'reset-day';
