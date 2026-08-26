# Builder: WYSIWYG authoring model

Date: 2026-08-24
Status: selected product/interaction model; implementation prototypes are bound to the current `/build/[course]` and `/build/[course]/[lesson]` routes.

Selected visual truth: `/Users/G/.codex/generated_images/01a02eb7-cc6f-7d30-9bb0-f199a4f408a7/exec-b98fc11e-8db3-4487-bab5-270f82c033d2.png`.

## Product definition

CenterWay Builder is a quiet editor of a living learning document, surrounded by course structure, contextual properties and a safe release path. It is not an LMS admin form and not a general-purpose page builder.

One course has three projections rather than three copies of content:

`author document -> learner experience -> marketplace projection`

- `/build` edits the canonical course document;
- `/learn` renders the published learner projection;
- marketplace surfaces consume explicitly selected course/offer fields and the approved release.

## Reference synthesis

- Circle contributes curriculum structure: sections/modules, lessons, drag order, draft/published state and a separate lesson workspace.
- Thinkific New Course Builder contributes learner-like inline WYSIWYG and a mixed-content lesson canvas.
- Ghost contributes the quiet writing surface, contextual formatting, `/` insertion and internal `@` linking.
- Rise contributes reusable semantic block templates.
- CenterWay owns import normalization, readiness blockers, review, learner release, marketplace listing and the agent boundary.

These products are references for interaction principles, not visual templates. The visual language remains CenterWay.

## Three authoring levels

| Level | Author question | Primary surface |
| --- | --- | --- |
| Course shelf | Which course needs work? | list/cards, import, operational status |
| Course | How is it structured and what blocks publication? | `Курс / Зміст / Публікація` |
| Lesson | What exactly will the learner read and do? | learner-measure WYSIWYG document |

Marketplace is not a fourth editor. It is a publication projection configured in course properties and `Публікація`.

## Naming

Ukrainian copy carries no Latin-script product names where an established
Ukrainian anglicism exists: «білдер», not «Builder», in the cover hint and the
tab title. `CenterWay Білдер` is the tab title now.

The nav label formerly «Навчання» is «Бібліотека» — a shelf of what the learner
already holds, read spatially against the platform's other rooms (`Профіль`,
`Білдер`). It is not the final word on that vocabulary; the direction is toward
consistent spatial metaphors across the layer/module system rather than mixed
registers (an action noun beside a room noun beside an English loan).

## Course workspace

The Builder shell is intentionally not the public marketplace shell. Public
and funnel surfaces may use floating glass and expressive tone changes;
internal workspaces use one full-width warm topbar at the viewport edge, with a
hairline boundary and no raised floating silhouette. Navigation/account
behaviour stays shared, while the material recipe follows the surface intent.

The internal frame has one viewport contract: the workspace topbar owns the
first `4rem + hairline`; below it, desktop navigation and tool rails occupy the
remaining viewport height and do not participate in document scrolling. On
compact layouts the course tabs belong to the central scroller and stick to its
local top edge, so they never compete with the topbar for `top: 0`.

On desktop the topbar addresses the complete workspace width and stays above
both rails. Builder and learning are task surfaces, so they do not render a
platform footer; the approved quiet brand line belongs only to the public
platform footer.

One bar, every level, learning included. The context row is unconditional —
the course index renders it with a single crumb and no document actions rather
than dropping it — so moving between index, course, lesson and `/learn` never
changes the height or the material of the chrome. Learning wears the same flat
workspace bar instead of the storefront's floating plate: an author crossing
between `Переглянути` and the editor is looking at two views of one document,
and the bar is what makes them read as one product.

The lesson route context lives inside that topbar: course, module and lesson
breadcrumbs sit between the brand and document actions; preview, autosave and
blocker state stay visible without taking a row from the manuscript.

The default structure view is a manuscript-like row outline:

- drag grip directly before module/lesson title;
- inline pencil rename;
- quiet draft/readiness state;
- lesson count;
- overflow for rare or destructive actions;
- add-lesson/add-module rows in the same rhythm.

Cards remain an optional overview for large courses, never the default working form.

The bound course prototype treats `Зміст` as a real table of contents rather
than an administration list:

- the course title is the quiet running head and `Зміст` is the editorial page title;
- sequential modules and lessons use stable visible folios (`Модуль 01`, `01.01`), while reference modules are named `Довідка` and stay outside the sequence;
- lesson day/block metadata remains visible without becoming a status pill;
- a collapsed module keeps a one-line preview of its first lesson titles;
- mobile shortens folios to local `01`, preserves the row hierarchy and keeps reorder actions in the accessible overflow menu;
- the optional wide card view groups by module, but lessons remain hairline rows and never become cards inside cards.

Course modes answer distinct questions:

- `Курс`: identity, promise, cover, audience and marketplace projection;
- `Зміст`: modules, lessons and order;

Publication does not belong to the lesson: it is a whole-course trust and
boundary decision. At course level, `Публікація` is the third mode in the
left course rail and opens in the same central workspace as `Курс` and
`Зміст`; it is not a second right-hand drawer.

Only one mode is open at a time. Release blockers do not occupy the first screen of the content workspace.

### The outline restructures, not only navigates

Inside a lesson, the left outline reorders and deletes: a grip on every module
and lesson row, and a row menu carrying the same moves for a keyboard or a
finger, where the grip is not rendered. This is not a duplicate of the course
workspace. An author restructuring a course does it WHILE reading the lessons,
and being sent to another screen to move one lesson up meant leaving the thing
they were judging it against.

The outline reads as titles when nothing is being done to it. Grips and row
menus are invisible until the pointer is on THAT row — `.dragRow:hover` used to
reveal them, and a module block is a drag row containing all of its lesson rows,
so pointing at one lesson lit the module's handle too and the list became a
column of handles waiting for a gesture nobody was making. Lesson rows carry no
page glyph: every row in a course outline is a lesson, so an icon saying
«lesson» on all of them said nothing and was filler between the grip and the
number. The lesson document opens on its title alone — the module and the title
in small type above it repeated the breadcrumb word for word.

The arithmetic is shared with that screen — `structureMoves.ts` owns every move
and removal, and both surfaces call it — so the two cannot drift into
disagreeing about what a move means. It also owns the refusals, which are the
shape `validateCourse` insists on rather than taste: the last module does not
go, the last lesson of a module does not go (that is a request to delete the
module), and a module cannot be emptied by dragging its last lesson out. A
refusal returns nothing rather than an unchanged list, so a caller can tell «this
does nothing» from «this is not allowed» and say which.

Deleting the lesson on screen, or the module holding it, leaves for the lesson
beside it FIRST. The destination is computed from the course as it still stands,
the removal is applied, and only the render after that commit navigates —
otherwise the editor would be left with no lesson to render, and the author who
deleted one would be looking at «Урок не знайдено».

### Nothing in the document asks to be noticed

The lesson used to carry its tools permanently: a pencil beside the title, a
header row over every block with its type in mono caps, a ring parked in every
gap with a rule drawn above the first one. None of that is content, and all of
it was on screen while an author was reading their own words. Everything now
waits to be asked for — pointing at a block brings up its handle rail in the
margin, pointing at a gap draws its rule and puts the ring in it, and selection
is a rule in the margin rather than a tint under the prose.

The page carries a gutter on each side of the 46rem measure for those handles.
Hung outside the page they would be clipped, since a scrolling element is not
`overflow: visible` on either axis; hung inside the text they would sit on the
first word of every block.

Choosers float. The `+` opened a panel that REPLACED the gap in the flow, so
pressing it threw the rest of the lesson down the page and closing it threw it
back; it is now fixed against the ring that opened it, like the slash menu and
the row menu. A chooser is a momentary thing and has no business moving the text
it is about to be inserted into.

A carried block lands in a GAP, not on a row. What an author aims at is the
space between two blocks, and asking them to find the correct half of the
correct block is asking them to hit a target they cannot see. The document owns
the drop and nominates the nearest gap by distance, so the hint appears as soon
as the drag starts moving and pulls to the nearest seam — and a block carried
from the palette answers to exactly the same hint as one carried from the page.
A palette drag carries a named chip rather than a snapshot of a tool-panel row.

### Content is edited at the block; the panel holds properties

Selecting a block opens its fields under it, in the document. They used to live
in the right drawer, which meant editing the words of a table happened three
hundred pixels from the table — the author read one thing and typed into
another. Selection also stopped opening the panel: pointing at what you are
writing should not rearrange a third of the screen.

What stays in the panel is what the block IS rather than what it says — where it
sits, what it is for, how often it repeats. Its own menu carries «Властивості
блоку» so the panel is reached deliberately.

The block IS the editor. It is the learner's own rendering with every addressed
text leaf handed back as a field, so a table is typed in the table and a practice
in the practice, at the size and face they will be read at. There is no editable
twin of the thirteen block types to drift away from the ones learners see — the
renderer says WHERE each leaf lives, an authoring caller supplies a render
function for those addresses, and `LessonBlocks.tsx` stays ignorant of the
builder. An optional leaf renders its wrapper anyway while authoring: a title
that only appears once it has been written is a title that can never be written.

Those fields render as spans, not divs. They sit inside the block's own markup —
inside a `<p>`, an `<h3>`, a `<summary>` — where a div is not allowed; the
browser reparents it silently, the server and client trees stop matching, and
React throws the subtree away.

What is left under the block is what the rendering could not take over: numbers,
media, links, flags, and any inline leaf the renderer never draws. Exactly one
leaf is in that last case — the video's title for screen readers — and it says
so in `blockFields.ts` beside its own descriptor rather than in a list somewhere
else that would drift.

The title is the same idea one level up, and it takes exactly one form — a
field shaped like the heading, no mode and no pencil, pointing at it puts the
caret in it — inside the lesson document, where the words on screen ARE the
words being written.

### Two registers for a title

The course screens are a different kind of surface, and the same field there
was the wrong answer rather than a smaller version of the right one. A course
title sits above a row of settings; a module title is one line in a list of
modules read top to bottom. A reader scanning a structure is not the same
posture as an author mid-sentence, and a column of live fields turns a
structure into a form — every title looks pressable, and once one thing on the
sheet has a caret waiting in it, so does everything else the eye passes over.

`BuilderEditableTitle` now takes a `register`: `document` renders the field
described above; `record` renders a heading with a pencil, editing opened on
request, matching the pencil every settings row already carries. The course
title and every module title are `record`. The lesson document's own title
stays `document` — it is the one title on any course screen that a reader is
actually there to write.

The course's one-line summary got the same correction under a different name.
It used to be a live field sitting inside a sheet of settings ROWS — label,
value, pencil — and read as the one thing on the page you could type into
without asking, in a stack of things you look at and then press to change.
`BuilderRecordField` gives it the row's own shape: text, then the pencil,
opening the ordinary inline editor on request rather than holding it open
always.

### Moving between lessons is not a navigation

The editor holds the whole course, so a move to a sibling lesson is a state
change and the URL follows it with `history.pushState`. It used to be a route
change, which meant saving the course over the wire, waiting for the page to be
rendered again, remounting the editor and refetching the course it had just
sent — seconds, to look at something already in memory. Nothing is lost by not
saving first: the course is one document and autosave owns writing it. Deep
links, back and forward still work, because arriving by route seeds the state
and `popstate` puts it back. Anything LEAVING the course still leaves the
ordinary way — saved first, then routed.

Because the swap now lands between two frames, the document carries a short
dissolve keyed on the lesson, and the scroller returns to the top. Without them
an author cannot tell whether the document changed or their own edit did.

Lesson rows in the outline are anchors, not buttons. A plain left click is taken
over for the in-place switch; every modified click, and the right click, is left
to the browser, so «відкрити в новій вкладці» and «копіювати адресу» keep
working on the list an author opens lessons from. The module head keeps the
right click as its fast path to the row menu — it has no address to offer.

### One selection language

Hover and selection are the same object at two strengths: the hand's own
`ink-stroke` under the label, faint under the pointer and full on the current
row. Nothing in the builder is allowed to answer this twice. The plates it
replaces were a real defect, not a taste call — a tinted fill used for both
states makes the current row read as stuck hover the moment the pointer rests
on it, and a rectangle drawn around a row turns a list of names into a list of
buttons. Any row that can be pointed at or chosen composes `inkRow` and renders
an `InkLabel`. Keyboard focus keeps the design system's focus ring: it answers a
different question, and at hover strength it would be too quiet to use.

The workspace paints one sheet of paper. The topbar and the panels take
`--cw-platform-bg`, not the white card material they used to copy, and what
separates them is a drawn rule — the page's own ink at drawing strength rather
than the seam between two plates. Carrying that analogy further, to a real
drafted line whose weight varies along its length, belongs in the design system
at art-direction level and is not something one module should invent.

The tool panel's mode tabs are a strip on its outer edge, never a column inside
it: folded in, they ate a fifth of the drawer's measure and turned one tool
panel into two.

### Panel symmetry, and a fixed axis

Below the topbar the workspace is three tracks: outline, document, tool layer.
The outer two are the SAME object seen twice — same reserved width, same rail
width when folded, same inline padding, same easing, and a collapse foot that
is one shared button role (`bar` in `PlatformButtons.module.css`) sitting in
the same row of each panel's grid, so both arrows land on one baseline.

The side tracks never resize. Collapsing narrows the PANEL inside its track;
the track, and with it the document, does not move by a pixel. The freed room
stays empty on purpose — a side panel may not buy width from the manuscript by
folding away, because the line an author is reading would then reflow every
time they glanced at the outline. A surface with no tool layer at all — the
course workspace — reserves the third track anyway, so it shares one axis with
the editor.

This replaces a hand-tuned left margin that compensated for one panel being a
grid column and the other an overlay. The document's centre line is now a fact
of the frame rather than a number to maintain: measured at 1600px, the lesson
document is 432…1168 in all four panel states.

## Lesson workspace

The lesson document uses one shared reading measure with learner: `46rem` on desktop and `100% - 2rem` on mobile. Typography, spacing, media width and semantic block rendering are shared with `/learn`.

The wide authoring workspace remains available around that document:

`course structure | learner-measure document | contextual properties`

Side layers never move the document axis when opened.

### Inside the document

Only learner-visible content belongs inside the sheet:

- module/day context when learner-visible;
- lesson title and summary;
- prose and media;
- practice, assignment, reflection and completion blocks;
- support, expectation, boundary and contraindication blocks;
- learner-visible duration or resources.

### Outside the document

Lesson properties own operational fields:

- day index and calculated duration;
- slug and canonical address;
- prerequisite, required completion and schedule;
- access, draft state and release visibility;
- source import/replace action.

Selected-block properties own alt text, media source, block behavior and semantic configuration. A property may render a read-only learner preview inside the document while remaining editable only in the property layer.

## Contextual block insertion

Two entry points share one block registry:

- `+` between blocks inserts at an explicit position;
- `/` in an empty paragraph transforms/inserts without leaving writing flow.

The first menu is short and searchable. It starts with recent/basic actions, then groups the complete library:

- text/media: prose, heading, list, quote, image, gallery, audio, video, file, table, code;
- learning: practice, protocol step, checklist, question, assignment, reflection, next step, completion;
- care/boundary: soft frame, expectation, support, warning, boundary, contraindication;
- reference: internal link, source quote, related material, glossary/reference card.

Desktop uses a compact ceramic popover near the insertion point. Mobile uses a bottom sheet. The library is never a full grid before the author asks for it.

### Spatial tool contract

The two side zones have stable, non-interchangeable roles:

- left is navigation: course structure, modules, lessons and reorder;
- right is action and context: block library, selected-block properties, page properties and publication readiness.

The right layer has four stable micro-tabs inside the header of one tool rail:

1. `Блоки` — searchable registry, recent/all modes, drag/drop and repeated assembly;
2. `Властивості блоку` — fields and behavior of the selected block;
3. `Властивості сторінки` — lesson identity, day, duration, address and import/replace;
4. `Публікація` — readiness, preview/review state, learner publication and marketplace listing.

The three lesson tabs are persistent affordances, not simultaneous panels. On
desktop they form a compact vertical group outside the right drawer, rather
than a full-height rail; the drawer has the same width as the left structure
panel. Selecting a block switches that
same drawer from library to properties without overlaying or moving the
document. The active tab is signalled by foreground/weight plus the shared
ink-ring/stroke, never by a raised card. On mobile the same three modes become
the header of one bottom sheet.

Both desktop drawers are independently closable from a small bottom arrow
inside their own footer. The compact tool group remains as a stable reopen
target, while the document measure stays unchanged. The left structure heading
is a full-width back affordance to the course level, with its arrow preceding
the text; it is not the drawer-close action.

All insertion entry points address the same registry and current insertion anchor:

- inline `+` appears between blocks and on an empty paragraph;
- `/` opens the searchable command menu at the caret;
- the right drawer supports browsing, search and drag/drop for repeated construction;
- `@` remains a separate internal-reference command and never opens the block library.

On mobile there is no persistent side rail. `+`, `/`, block properties and the library open as a shared bottom-sheet family; course structure remains a separate full-screen drawer. The course publication drawer remains separate from lesson tools. The author always returns to the same document position after either layer closes.

## Internal course linking

Typing `@` opens an internal reference search ranked by learning context:

1. previous lesson;
2. already available earlier lessons;
3. current module;
4. whole course;
5. shared CenterWay materials.

Targets may be lessons, headings/blocks, practices, glossary items or resources. Results can render as inline link, compact mention, reference card or “remember this practice” block.

References store stable entity IDs plus display text, not raw URLs alone. Renaming title or slug updates the rendered link. A reference to inaccessible future content warns the author; broken references become readiness warnings/blockers.

## Import path

Import is a staged authoring path, not a blind upload:

`source -> parse -> module/lesson map -> transformation preview -> hidden draft -> WYSIWYG edit`

Supported author intentions:

- create a new course from source material;
- append lessons to an existing module/course;
- replace the editable body of the current lesson while preserving identity/order;
- attach a source file without transformation.

The preview names detected modules, lessons, media, duplicates, unresolved fragments and warnings. Every import lands in an undoable hidden draft and cannot publish itself.

## Agent contour

The agent is contextual rather than a permanent chat column:

- shelf: identify source/format and duplicates;
- course: map modules, detect sequence gaps and prepare marketplace copy;
- lesson: transform selection, create semantic blocks, propose earlier-lesson references and detect repetition;
- release: explain blockers, validate links/alt text/claims/boundaries and prepare release summary.

Every write is shown as a diff with accept, partial accept, reject and undo. The agent cannot publish, change access, list a course or communicate externally for the author.

## Release path

The editor shows one compact status line only:

`Чернетка · усі зміни збережено · 2 блокери`

`Публікація` expands the full sequence:

1. content/media/reference readiness;
2. learner preview verification;
3. review;
4. publish to learning;
5. separately list in marketplace.

Learner publication and marketplace listing are distinct permissions and actions.

## Responsive model

- `>=901px`: structure, document and properties form three stable viewport columns; the document axis stays fixed and only its centre column scrolls;
- `561–900px`: structure is a drawer, properties a sheet, insertion a compact popover/sheet;
- `<=560px`: document only; structure is full-screen drawer, properties and block library are bottom sheets, reorder has explicit move up/down actions.

## Zen preview contract

Обычный `Переглянути` отвечает только на вопрос «как сейчас выглядит
сохранённый draft у ученика?». Он не является learner simulation.

- тело курса/урока рендерит тот же `CourseView` / `LessonView`, что и обучение;
- draft API остаётся author-guarded и не пишет learner progress;
- Builder/platform header, rails, footer и редакторские инструменты отсутствуют;
- единственная временная граница находится сверху: `До редагування` и
  `Чернетка · збережено`;
- autosave завершается до входа в preview; при ошибке автор остаётся в Builder;
- `returnTo` переносится по всем внутренним preview-ссылкам;
- возврат перескакивает всю preview-навигацию и восстанавливает исходную
  Builder history entry, а при прямом открытии использует безопасный `/build/*`
  fallback;
- отдельная learner simulation для drip, prerequisites, completion и полного
  course flow не входит в базовую версию.

## Required lesson states for visual design

1. clean writing/reading state;
2. selected block with sparse author controls;
3. `/` block menu;
4. `@` internal-reference menu;
5. lesson/block properties layer;
6. import mapping;
7. agent diff;
8. compact blocker/release entry.

The first wireframe wave covers states 1–5 on desktop; mobile follows the selected composition.

## Material grammar

The base light system moves toward warm near-handmade ink graphics on parchment/clay. Dark theme is a separate later contract, not an automatic inversion of this wave.

- **Paper/parchment** is the continuous page and document ground. It carries reading and authoring content without a surrounding card.
- **Charcoal ink** owns structural boundaries, dividers, field outlines, module rows, navigation strokes, icon rings and focus geometry. Lines may be subtly irregular, but state and contrast remain explicit.
- **Ceramic** owns temporary tools held “in the hand”: block picker, property sheet, popover, import mapping and contextual toolbar. It is warm, opaque/matte and sparingly raised.
- **Mineral** owns weight and limits: boundary/contraindication, destructive confirmation, hard release blocker and occasional proof/trust anchor. It does not become the default card background.
- **Warm guide accent** owns one next action or current progress point. Autosave, formatting and navigation remain ink-led.

No surface appears merely to group content. Prefer spacing, alignment, typography and charcoal rules before fill, border or shadow. Ceramic/mineral recipes require a semantic role; otherwise the component remains on paper.

## Scaling authors

The initial interface optimizes for one/few authors and omits presence, comment threads and permission matrices. The data/operation contract preserves author ownership, versions, revision history, review status and agent audit so editor/reviewer roles can be added without redesigning the document.

## Bound prototype and implementation plan

The interactive prototypes are the current course and lesson routes themselves. Lesson evidence is stored in `output/playwright/builder-tool-rail-desktop.png` and `output/playwright/builder-tool-rail-mobile.png`. Course-structure evidence is stored in `output/playwright/course-structure-rows-desktop.png`, `output/playwright/course-structure-rows-collapsed.png`, `output/playwright/course-structure-cards-wide.png` and `output/playwright/course-structure-rows-mobile.png`.

Implemented in the first slice:

- contextual platform bridge without the full marketplace/platform navigation;
- expanded course structure on desktop and the existing mobile structure drawer;
- learner renderer and `46rem` learner measure inside the authoring document;
- one stable desktop tool column with the four modes `Блоки / Властивості блоку / Властивості сторінки / Публікація` and one mobile bottom sheet;
- searchable block library, click insertion and native drag payload to the active `+` anchor;
- inline `/` command menu from the same structural vocabulary;
- operational page fields and import moved out of the learner document;
- selected semantic block rendered like the learner sees it and edited in the property rail;
- compact readiness and navigation to the full course publication surface;
- learner document axis remains unchanged while the right rail changes mode.

Implemented in the reference slice:

- typing `@` inside learner-visible prose opens a separate contextual search, never the block library;
- results are ranked as previous lesson, earlier lessons, current module, whole course and reference materials, with lesson-owned semantic blocks included where they have stable block identities;
- stored targets use stable `cw-ref:lesson:*` / `cw-ref:block:*` identities rather than mutable slugs;
- the learner renderer resolves current titles, slugs and block anchors from the current course map;
- missing targets and links into hard-gated future days become publication-readiness blockers;
- keyboard selection (`ArrowUp/ArrowDown`, `Enter`/`Tab`, `Escape`) and the existing mobile ceramic command surface share the same no-axis-shift geometry.

Next implementation waves, in priority order:

1. **Reference depth:** stable identities for individual rich-text headings, glossary entries and shared cross-course materials; current slice already covers lessons and typed lesson blocks.
2. **Library depth:** recent blocks, category collapse, keyboard search, touch drag alternative and reusable block presets.
3. **Import workbench:** module/lesson mapping, append/replace choice, transformation preview and media reconciliation.
4. **Publication convergence:** keep the four-tab lesson summary and course-level `Публікація` on one readiness/review/marketplace contract; remove remaining internal release terminology from user-visible copy.
5. **Agent contour:** selection-scoped transformations and diff acceptance before any broader course-level automation.
6. **Scale readiness:** reviewer role and presence only after real concurrent authorship appears; do not add collaboration chrome before then.

Acceptance gate for each wave: document width and x-axis are invariant between collapsed/open tool states; learner-visible blocks are rendered by the learner renderer; mobile has one bottom sheet at a time; no authoring operation can publish or list a course implicitly.

## Course overview settings surface

`Курс` follows the same manuscript rule as `Зміст`: the default state is a
readable course document, not an always-open configuration form.

- The first level contains four hairline-separated semantic rows: marketplace
  projection, rhythm, appearance and cover.
- Each row states its current value and carries one persistent pencil action.
  Only the selected row reveals its controls; opening another row closes the
  previous one.
- Choice controls keep the shared touch-target contract but present as quiet
  text with an active underline on the paper surface, rather than a row of
  large filled cards.
- Rare/destructive setup work — replacing the lesson structure and editing
  entitlement product codes — sits under one native `Додатково` disclosure.
  Template presets use a select rather than a grid of competing cards.
- Course title, summary and route remain in the document head where they are
  read. Publication and marketplace visibility remain separate boundaries.

This is a presentation/progressive-disclosure change only. The typed `Course`
DTO and the authoring API paths remain unchanged.
