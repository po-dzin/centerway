# Builder portable course import/export

## Purpose

Move authored courses into and out of Builder without coupling the platform to
SendPulse, SmartSender, or any other vendor. The portable file is the canonical
`Course` JSON already used by `data/courses/*.json`, `npm run lms:import`, and
`npm run lms:pull`.

## Import contract

Builder exposes a two-step authenticated flow:

1. `POST /api/lms/authoring/import` with `{ "course": <Course>, "commit": false }`
   validates the file and returns a preview. It does not write.
2. The same request with `commit: true` validates again and creates a new course.

An imported course is always a copy:

- `status` becomes `draft`;
- `visibility` becomes `hidden`;
- `entitlementProductCodes` becomes `[]`;
- `version` becomes `1`;
- `sortOrder` is removed;
- course, translation group, module, lesson, block, checklist-item, and FAQ-item
  identifiers are regenerated;
- a colliding slug receives a numeric suffix.

Readiness blockers do not reject a draft. They are shown in the preview and
remain visible in Builder. A structurally invalid course is rejected before any
normalization or write. The request body limit is 5 MiB; course media stays in
the JSON as URLs rather than uploaded binary data.

## Export contract

`GET /api/lms/authoring/courses/:slug/export` returns the current database course
as formatted UTF-8 JSON with `Content-Disposition: attachment`. The route uses
the same row-level Builder ownership check as the editor. Prices and offers are
not part of `Course` and therefore are not exported.

The downloaded file can be:

- imported through the Builder preview;
- validated with `npm run lms:import -- file.json --dry-run`;
- imported by the existing CLI when a service-role workflow is intended.

## Boundary

This is a local authoring/runtime contract. It does not change public route
semantics, pricing, payments, publication rules, or shared RAverse canon.

## Lesson document transfer

Course JSON remains the lossless environment-to-environment format. Builder
also accepts author-facing lesson pages inside an existing course:

- `.md` / `.markdown`;
- `.docx` (Office Open XML Word; legacy binary `.doc` is not accepted);
- UTF-8 `.txt`.

The import control lives inside a module. Multiple files may be selected; each
file becomes one lesson appended to that module. The first level-one heading is
the title, otherwise the filename is used. Paragraphs, headings, ordered and
unordered lists, task lists, quotes, fenced code, and Markdown images become
typed LMS blocks. Every imported lesson receives fresh IDs and a course-wide
collision-free slug. Daily courses receive the next available day index;
reference modules do not. Import changes only the in-browser draft until the
author explicitly saves the course.

`POST /api/lms/authoring/courses/:slug/lessons/import` accepts multipart files
behind the same Builder ownership check. Limits: 20 files per request and 5 MiB
per file. Embedded DOCX images are not copied into media storage; authors add
them through the existing Builder media flow.

Each lesson row exposes Markdown, Word (`.docx`), and plain-text export.
`POST /api/lms/authoring/courses/:slug/lessons/export` accepts the current
in-browser lesson shape, so exports include unsaved text edits, validates its
blocks, and returns an attachment. The Word output is rendered from the same
typed blocks rather than from HTML.
