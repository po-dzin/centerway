# Course → author → consultation flow

Requested 2026-08-31. Screenshots are defect evidence, not additional instructions.

## Delivery order and acceptance

1. **Admin / publication.** Listing checks the approved live version independently
   of a pending revision. The catalogue also exposes the revision's review state.
   Admin can deliberately delete a course with learners after typing its slug;
   authors/support cannot use that operation. Explain loss of lessons, access and
   progress; retain orders, accounts and audit history. No real course is deleted
   as part of implementation. Sidebar: left/right command, no selected plate or
   selectable label, one vertical rule. Toast shadows must not meet a square clip.
2. **Course flow.** A final next-step course carousel reuses homepage cards and
   public visibility filtering, excludes the current course and empty shelves.
   Format already exists under Builder → Обкладинка → Формат; composition lives
   separately under Сторінка → З чого складається. Free access is not a format.
3. **Author.** One profile model/editor shared by cabinet and Builder; only
   authorNote is course-specific. Explicit save/sync to one's own profile; never
   overwrite another person's profile merely because an admin edits their course.
   Six about facts, first three in concise lists, required experience/achievement
   badges for publication; photo, biography, quote, education and consultation.
   Compact independent media/text columns eliminate photo-height holes. Remove
   the author tab's leading divider; course editor link reads «Редагувати».
4. **Consultation.** /consult becomes a directory of available consultants;
   /expert/[slug] holds each person's identity, facts, path, consultation format,
   steps, expectations, boundaries, FAQ, contact and public courses. Preserve the
   founder's existing copy and link known founder courses explicitly, not by name
   inference. Do not change isolated consult/reboot/irem funnel routing.
5. **Bug reports.** Platform footer includes the requested Ukrainian sentence,
   underlined «дайте нам знати» leading to bot start=bug. Bot has a distinct bug
   intake and technical-topic delivery, with failure feedback and no false success.
   Do not send test messages to real people without explicit authorization.

## Semantic preflight

All surfaces use existing global app DS (`cw.tokens.json` → globals.css), shared
button/material/ink recipes; no local palette, radii, shadow or ink geometry.

| Surface/block | Role / user question | Content source | Boundary / selection |
| --- | --- | --- | --- |
| Admin catalogue | method/boundary: what is live; what will deletion remove? | lms_courses, enrolments, API | structural rows; quiet commands/confirmation, contour |
| Admin rail | orientation: where am I; can I collapse navigation? | admin route map/i18n | one structural rule; nav ink, collapse command contour |
| Shared toast | support: what happened? | action result/i18n | quiet overlay; close contour, existing shared hover |
| Course next step | progress: what can I study next? | public course catalogue | collection none; card navigation ink/shared offer recipe |
| Author editor | trust: what will readers learn about me? | own lms_authors row, per-course authorNote | structural groups; inputs/save/upload contour, visibility essential |
| Author page/cards | trust/proof: who leads; what experience and courses? | lms_authors + explicit course links | collection none; navigation ink |
| Consultation directory | route/offer: who can help with my request? | listed author consultation settings | collection none; navigation ink |
| Footer report link | support: where can I report a defect? | requested copy + bot deep link | none; link ink |

Routes: platform/public and personal workspace only; isolated funnels unchanged.

## Diagnosis

- Live read: reset-day is published/approved/hidden, pending review in_review.
  moderateCourse incorrectly used pending_review_status for visibility.
- Founder profile slug is currently koriakin. way21 and natural-body have no
  author_profile_id; reset-day is linked but hidden. Never link Short/IREM to
  this founder: those belong to a separate author flow.
- Toast viewport clips its own cards' shadows (overflow-y:auto without padding).
- Admin rail adds a border to chrome's shadow contour; expanded nav also paints
  both a text stroke and icon ring. Collapse arrow uses the wrong axis.
- Author grid ties the name row height to a large portrait, causing empty space.

## Verification / rollout

Implemented locally. Verification on 2026-08-31:

- `semantic:audit` and `guard:ds-contract` pass;
- ESLint and TypeScript pass;
- 101 focused admin/catalog/author/support-bot tests pass;
- the production Next.js build passes;
- Playwright desktop 1440×1000 and mobile 390×844 checks pass for
  `/programs/way21` and `/consult`: HTTP 200, no horizontal overflow or console
  errors; next-step cards and the footer bug deep link are present;
- screenshots live under `output/playwright/` as local QA artifacts.

The canonical database change is
`docs/migration/sql/2026-08-31_author_consultation_profiles.sql`. It adds the
profile and consultation fields, moves the founder consultation content into
the shared profile, links `way21` and `natural-body`, and enforces complete
badges on future public-profile writes without changing visibility of existing
profiles. The generated
`supabase/migrations/**` copy remains ignored by repository contract.

Remote SQL was applied on 2026-09-01 through the project's documented IPv4
session pooler in one transaction and recorded as migration version
`20260831000000 / author_consultation_profiles`. Post-write verification found
the founder public and consultation-enabled with 6 facts, 2 profile blocks and
both required badges. `way21`, `natural-body` and `reset-day` are linked to
`koriakin`; only the first two appear in the public count because `reset-day`
is hidden. `BUG_REPORTS_THREAD_ID` remains optional and safely falls back to
`SUPPORT_THREAD_ID`.

Follow-up 2026-09-01: the profile course count moved into the compact identity
status and the shelf heading became `Курси автора`. `profile_blocks` adds up to
12 ordered author-owned text/list/timeline sections. Founder backfill now
contains the complete three-paragraph story and the ten-item education path
that previously lived only in the static consultation component. A clean-cache
Playwright pass confirmed `/consult` and `/expert/koriakin` on desktop and
mobile: HTTP 200, consultant card and profile link present, biography,
timeline, consultation and 2 public course cards present, with no horizontal
overflow or console errors.

Builder author-tab follow-up 2026-09-01: the tab is now a projection of the
shared author profile rather than a second profile form. Its compact structural
card shows portrait, name, role and readiness across ten author-owned content
groups, states that the data is shared by all courses, and routes the owner
directly to `/profile#author`; the cabinet opens that editor when addressed by
the hash. Returning to Builder refreshes the linked profile on focus/pageshow.
The only course-specific input below the card is `authorNote`, labelled
«Чому саме ви створили цей курс». This one-sentence course context is printed
only in the public course's author block, never on the author profile or another
course. An author retains control of their own course's profile link: they may
replace an admin-set fallback with their profile or clear it. Admin → Каталог →
Авторство has a separate author-profile selector for first assignment and
operational corrections. Its write updates only `lms_courses.author_profile_id`,
verifies that the selected profile exists and audits the old/new ids; it never
writes the selected `lms_authors` row.
