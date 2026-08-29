-- CenterWay: way21 and natural-body stop having a hand-written page.
-- APPLIED 2026-08-29 to production over the session pooler, in the pass that
-- deleted src/app/(platform)/programs/{way21,natural-body}/page.tsx.
-- Recorded here after the fact: every other production write that day got a
-- file, and this one is the reason two offer pages changed source.
--
-- A static route segment always beats `[slug]` in the Next router, so flipping
-- `visibility` alone would never have surfaced the course-driven page. The
-- folders had to go, and once they were gone the database had to already carry
-- everything the deleted TypeScript said — otherwise the move would have
-- published a thinner page than the one it replaced.

BEGIN;

-- ─────────────────────────────────────────
-- 1. way21 keeps the copy that was approved
-- ─────────────────────────────────────────
-- `summary` takes content.ts's longDescription rather than the shorter line
-- already in the row: it is the only version carrying the "wellness education,
-- not medical treatment" boundary, and that sentence must not vanish because a
-- page changed where it reads from.
--
-- `summary` is jsonb — a JSON string, not text. A bare '...'::text UPDATE fails
-- with invalid input syntax for type json.
UPDATE public.lms_courses
SET tagline = $tag$21-денна аюрведична програма розвантаження: харчування, трави, режим і щоденні опори без жорсткого тиску.$tag$,
    summary = to_jsonb($tag$Програма перекладає принципи аюрведичного очищення у структуровану 21-денну програму: підготовка, м'яке виведення перевантаження, підтримка травлення, трав'яний супровід і повернення до стабільного ритму. Це wellness-освіта і направлена практика, а не медичне лікування.$tag$::text),
    results = $json$[
      "зрозуміти особистий ритм розвантаження і харчування",
      "підтримати травлення без крайніх обмежень",
      "зібрати простий режим сну, їжі, води і руху",
      "пройти програму з видимими межами методу і підтримкою",
      "вийти з програми з планом м'якого продовження"
    ]$json$::jsonb
WHERE slug = 'way21';

-- ─────────────────────────────────────────
-- 2. way21 gets a price the dynamic route can read
-- ─────────────────────────────────────────
-- Without this row the deleted static page's working checkout would have come
-- back as a generic lead form. The amount is the same live 1 UAH QA charge
-- PRODUCTS.way21 carries (CW_TEST_PRICE_1UAH); 4100 is what a page may quote.
INSERT INTO public.lms_course_offers (course_id, code, amount, list_amount, currency, access_lifetime, pixel_content_name, active)
SELECT id, 'course:way21', 1, 4100, 'UAH', true, 'Way21 Detox', true
FROM public.lms_courses WHERE slug = 'way21'
ON CONFLICT (code) DO NOTHING;

-- ─────────────────────────────────────────
-- 3. both become findable
-- ─────────────────────────────────────────
UPDATE public.lms_courses SET visibility = 'listed' WHERE slug IN ('way21', 'natural-body');

-- ─────────────────────────────────────────
-- 4. irem-gymnastics is addressed by the program it sells
-- ─────────────────────────────────────────
-- The rename earlier that day moved the row to `irem-gymnastics` and carried
-- `program_slug` with it, which broke the join OfferAccess makes: a shelf entry
-- carries the PROGRAM slug, and /programs/irem asks for 'irem'. The course's
-- own grant was invisible to the page selling it.
UPDATE public.lms_courses SET program_slug = 'irem' WHERE slug = 'irem-gymnastics';

COMMIT;
