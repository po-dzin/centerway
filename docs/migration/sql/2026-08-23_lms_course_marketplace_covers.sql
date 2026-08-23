-- Applied through supabase/migrations/20260823010000_lms_course_marketplace_covers.sql.
-- The two existing LMS courses now use the same artwork as their marketplace cards.
UPDATE public.lms_courses
SET cover = jsonb_build_object(
  'src', '/cw/platform/programs/way21-home-desktop-v1.png',
  'alt', 'Обкладинка програми «Шлях 21»'
)
WHERE slug = 'way21';

UPDATE public.lms_courses
SET cover = jsonb_build_object(
  'src', '/cw/platform/programs/reset-day-card-v1.png',
  'alt', 'Обкладинка практикуму «Розвантажувальний день»'
)
WHERE slug = 'reset-day';
