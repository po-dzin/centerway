# Builder: WYSIWYG authoring model

Date: 2026-08-24
Status: selected product/interaction model; implementation prototype is bound to the current `/build/[course]/[lesson]` route.

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

## Course workspace

The default structure view is a manuscript-like row outline:

- drag grip directly before module/lesson title;
- inline pencil rename;
- quiet draft/readiness state;
- lesson count;
- overflow for rare or destructive actions;
- add-lesson/add-module rows in the same rhythm.

Cards remain an optional overview for large courses, never the default working form.

Course modes answer distinct questions:

- `Курс`: identity, promise, cover, audience and marketplace projection;
- `Зміст`: modules, lessons and order;
- `Публікація`: readiness, review, learner publication and marketplace listing.

Only one mode is open at a time. Release blockers do not occupy the first screen of the content workspace.

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

The right layer has four stable micro-tabs at the upper-left edge of its rail/drawer:

1. `Блоки` — searchable registry, recent/all modes, drag/drop and repeated assembly;
2. `Властивості блоку` — fields and behavior of the selected block;
3. `Властивості сторінки` — lesson identity, day, duration, address and import/replace;
4. `Публікація` — readiness, preview/review state, learner publication and marketplace listing.

The tabs are persistent affordances, not four simultaneous panels. On desktop the active tab opens the same `280–320px` drawer; closing the drawer preserves the active tab in the narrow rail. The active tab is signalled by foreground/weight plus the shared ink-ring/stroke, never by a white highlight. On mobile the same four modes become the header of one bottom sheet.

The block library is not permanently expanded. A narrow right tool rail remains available on desktop; its block-library action opens a `280–320px` ceramic drawer over the reserved gutter without moving or narrowing the document. Selecting a block switches that same drawer to its properties. Wide desktop may pin the drawer for repetitive import/editing work, but the default state stays collapsed.

All insertion entry points address the same registry and current insertion anchor:

- inline `+` appears between blocks and on an empty paragraph;
- `/` opens the searchable command menu at the caret;
- the right drawer supports browsing, search and drag/drop for repeated construction;
- `@` remains a separate internal-reference command and never opens the block library.

On mobile there is no persistent side rail. `+`, `/`, block properties and the library open as a shared bottom-sheet family; course structure remains a separate full-screen drawer. The author always returns to the same document position after either layer closes.

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

- `>=1660px`: structure and properties may persist in authoring gutters; document axis stays fixed;
- `901–1659px`: document remains centered; only one side layer overlays at a time;
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

The first interactive prototype is the current lesson route itself: `/build/[course]/[lesson]`. Browser evidence is stored in `output/playwright/builder-tool-rail-desktop.png` and `output/playwright/builder-tool-rail-mobile.png`.

Implemented in the first slice:

- contextual platform bridge without the full marketplace/platform navigation;
- expanded course structure on desktop and the existing mobile structure drawer;
- learner renderer and `46rem` learner measure inside the authoring document;
- one overlay tool layer with the four micro-tabs `Блоки / Властивості блоку / Властивості сторінки / Публікація`;
- searchable block library, click insertion and native drag payload to the active `+` anchor;
- inline `/` command menu from the same structural vocabulary;
- operational page fields and import moved out of the learner document;
- selected semantic block rendered like the learner sees it and edited in the property drawer;
- compact readiness and navigation to the full course publication surface;
- learner document axis remains unchanged while the right drawer opens.

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
