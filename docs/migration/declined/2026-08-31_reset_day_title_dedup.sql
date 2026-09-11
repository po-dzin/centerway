-- Prepared, NOT applied. Run after review; unrelated authored titles stay intact.
-- Posttitle is already the format descriptor; do not duplicate it in the name.
BEGIN;
UPDATE public.lms_courses
SET title = 'Розвантажувальний день', updated_at = now()
WHERE slug = 'reset-day'
  AND title = 'Розвантажувальний день — практикум з умовного голодування'
  AND posttitle = 'практикум з умовного голодування';

UPDATE public.lms_courses
SET pending_content = jsonb_set(pending_content, '{title}', '"Розвантажувальний день"'::jsonb),
    pending_updated_at = now()
WHERE slug = 'reset-day'
  AND pending_content->>'title' = 'Розвантажувальний день — практикум з умовного голодування'
  AND pending_content->>'posttitle' = 'практикум з умовного голодування';
COMMIT;
