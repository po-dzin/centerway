# Retiring `lms_courses.posttitle`

The authoring model now has one optional author hook, `pretitle`, plus the
course description. Cards no longer render a second authored title line.

`supabase/migrations/20260920182019_migrate_course_posttitle.sql` preserves
every non-empty legacy value before dropping the column:

- if `summary` is empty, it becomes the summary;
- otherwise, if `pretitle` is empty, it becomes the pretitle;
- if `pretitle` already has the same text (ignoring case), the duplicate is
  removed;
- if both destinations already contain authored content, the migration fails
  rather than discarding text.

The same conversion is applied to `pending_content`, so an accepted pending
revision cannot restore the retired field. The current checked-in course
snapshots move their values to `pretitle` because both already have summaries.

## Application status

Applied to production on 2026-09-20 after restoring the two missing canonical
migration files (`20260915000000`, `20260920000000`) from their recorded
production history. Post-apply verification confirmed that the column is gone,
the migration journal records `20260920182019`, and the `reset-day` / `way21`
summaries remain unchanged while their former posttitles are in `pretitle`.

Local rehearsal and `npm run db:types` remain blocked because the local
Docker/OrbStack daemon is not running. Start it, then regenerate
`src/lib/db/database.types.ts`; its current generated snapshot still has the
retired column and must not be hand-edited.
