# Published-course version policy

## Decision

An approved published course keeps its live relational structure until a
reviewer explicitly releases a new version. Saving an edit never silently
changes what enrolled learners see.

## Direct fields

The author may update these fields on the live release without review:

- `cover` (image source and alt text);
- `sortOrder` (the author's own builder shelf order);
- an explicit unpublish action.

This is an allow-list. Any new course field defaults to the reviewable path.

## Reviewable version

Changing title, summary, tagline, results, schedule, entitlements, theme,
modules, lessons, lesson blocks, resources, or course settings stores one
complete pending `Course` document on `lms_courses.pending_content`.

- The learner continues to receive the current published projection in
  `lms_courses`, `lms_modules`, and `lms_lessons`.
- The Builder opens the pending document for its author and labels it as an
  update of an already published course.
- The author submits the saved update once; the admin sees
  `оновлення · in_review` rather than a second course.
- Approval projects that document into the live relational rows and clears the
  pending fields. Requesting changes keeps the pending document and its note.

## Operational boundary

The migration `docs/migration/sql/2026-08-23_lms_published_course_revisions.sql`
must be applied before authors edit an already published course. Until then,
the API rejects that content write rather than risking an unreviewed live
change (`lms_builder_revision_migration_required`).
