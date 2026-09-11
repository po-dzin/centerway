-- CenterWay: what the Reset Day offer page says, moved out of TypeScript.
-- Run in Supabase SQL editor (public schema).
-- Contract: src/lms-core/course.ts + src/lms-core/author.ts
-- Schema:   20260826000000_lms_course_offer_surface.sql
--
-- WHY THIS IS DATA AND NOT A CONSTANT. Until now /programs/reset-day printed
-- `programPageBySlug["reset-day"]` from src/lib/platform/content.ts. The page
-- and the funnel landing selling the same product had drifted into
-- contradicting each other in public — the platform said «1 день», the landing
-- said «3 дні» — because nothing forced them to agree and only a developer
-- could change either. This is the landing's CONCENTRATE, written where the
-- author can edit it.
--
-- NOT the landing's full copy: the problem cards, the comparison table, the
-- testimonials and the FAQ are a funnel's job and stay there. What moves is
-- what an offer page has to answer — who it is for, what changes, what it is
-- made of, how long, for how long, and who wrote it.
--
-- VOICE. The landing says «ти»; the platform says «ви» everywhere — bot,
-- reminders, cabinet. Copy carried across is converted, not pasted, or the
-- product would address one person in two registers inside a single purchase.

-- ─────────────────────────────────────────
-- 1. The author
-- ─────────────────────────────────────────
-- No photo yet, deliberately. The landing's portrait is served from
-- /shared/img/, which is the funnel hosts' tree and not reachable from the
-- platform, and pointing a column at a URL that 404s is worse than a block that
-- renders without a face. `listed` stays false: there is no profile page to
-- send anyone to yet, and the offer page only links to one when it exists.
INSERT INTO public.lms_authors (slug, name, role, bio, quote, credentials, listed)
VALUES (
  'yevhenii-koriakin',
  'Євгеній Корякін',
  'Засновник центру CenterWay',
  'Дослідник і практик аюрведи та сучасної дієтології.',
  'Мета розвантажувального дня — не «протерпіти», а навчитися спостерігати за собою. Саме тоді їжа перестає керувати вами.',
  '["Магістр комплементарної медицини, 15+ років досвіду",
    "Автор методик з дієтології та детоксикації",
    "Йога- та аюрведа-терапевт, переможець «Битви титанів»"]'::jsonb,
  false
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  role = EXCLUDED.role,
  bio = EXCLUDED.bio,
  quote = EXCLUDED.quote,
  credentials = EXCLUDED.credentials,
  updated_at = now();

-- ─────────────────────────────────────────
-- 2. What the page says
-- ─────────────────────────────────────────
-- `duration` is the one field that settles a live contradiction. Six lessons,
-- three days: the count was never wrong, it was answering a question nobody
-- asked. The author's own words win now, and the derived count is what a course
-- gets when its author has said nothing.
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
  author_profile_id = (SELECT id FROM public.lms_authors WHERE slug = 'yevhenii-koriakin'),
  updated_at = now()
WHERE slug = 'reset-day';

-- `visibility` is deliberately NOT touched. reset-day is served by its own
-- route, which does not read that column; flipping it to 'listed' would put the
-- course in the catalogue beside its own hand-written entry and sell the same
-- thing twice under two prices. That is the migration that still has to be
-- decided, together with an lms_course_offers row and what it charges.
