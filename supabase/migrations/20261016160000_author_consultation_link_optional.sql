-- An author's consultation no longer needs an external link (2026-10-16).
--
-- A reader asks for a consultation through the platform's own form on the
-- author's page, and the request carries the author's name. The external link
-- the cabinet asked for was the only way in before; now it is optional and is
-- passed to the team with the request, never printed on the page.
--
-- Title and summary stay required: they are what the hub's card and the
-- author's page show.

alter table public.lms_authors
  drop constraint if exists lms_authors_consultation_complete,
  add constraint lms_authors_consultation_complete check (
    consultation_enabled = false
    or (
      nullif(btrim(consultation_title), '') is not null
      and nullif(btrim(consultation_summary), '') is not null
    )
  );
