# Builder course workspace — design QA

## 2026-08-25 — lesson tools, course publication, and task-surface cleanup

**Verified states**

- `/build/test/lesson-1` at `1645 × 1114`: full-width warm workspace topbar; complete left structure panel; a separate `4.75rem` vertical mode rail; right tool drawer at the same shared width as the left panel; no lesson-level publication tab.
- `/build/test#course-release`: whole-course readiness/review/publish flow opens in a right drawer; the course content surface stays in place behind it.
- `/learn/test/lesson-1`: no platform footer.
- `/`: the public footer alone renders `Місце уважної присутності. Тут тихо.`.
- `409 × 1114`: Builder mobile menu exposes the account/profile rows; course publication uses its own bottom sheet; the lesson tool family remains separate.

**Interaction checks**

- Both desktop side panels close through their bottom arrow and remain reopenable from their stable rail.
- The profile avatar opens its desktop popover; the mobile menu makes the account actions visible on an opaque workspace-material sheet.
- Inline insert actions are icon-only `+` circles using the shared `ink-ring` graphic; no text-button contour remains.
- The lesson has exactly three tool modes: library, selected-block properties and page properties. The native startup-template select was replaced by the existing DS choice-row pattern.

**Validation**

- `git diff --check` — pass.
- `npm run lint` — pass.
- `npm run build` — pass.

No actionable P0/P1/P2 findings remain.

final result: passed

---

## 2026-08-24 — lesson editor three-column workspace

**Evidence**

- Source visual truth: `/var/folders/sq/4w_d403s78l84cn2wzfq2djh0000gn/T/codex-clipboard-6c60d0b8-8f34-4b94-b655-555b4febe763.png`.
- Browser-rendered implementation: `/private/tmp/builder-lesson-editor-final.png` on `/build/test/lesson-1`.
- Viewport and density: source `1487 × 1058` pixels normalized to `1488 × 1058`; implementation CSS viewport and screenshot `1488 × 1058` at 1× comparison density.
- State: authenticated lesson editor, block library active, first lesson current, all modules expanded.
- Full-view comparison: `/private/tmp/builder-lesson-editor-comparison-final.png`.
- Focused rail comparison: `/private/tmp/builder-lesson-editor-rails-focus.png`; needed because the hierarchy and tool-list density are too small to judge reliably in the full-width pair.

**Comparison history**

- P1: the initial implementation kept breadcrumb/actions inside the manuscript, rendered a flat navigation-only lesson list, and floated the tool drawer over unused outer space. Fixed by moving route/actions/status into the workspace header, binding a full module/lesson tree to the course DTO, and making the right tools a stable 300 px grid column.
- P1: the short lesson exposed the personal footer inside the initial editor viewport. Fixed by giving the document block canvas a viewport-relative minimum working height; the footer now starts at `y=1114`, below a `1058` px viewport, while remaining the final main-scroller block.
- P2: the right library remained card-heavy and had no stable release boundary. Fixed by reducing desktop block choices to compact rows and adding the fixed `blockers / Випуск` rail footer.
- Post-fix geometry at `1488 × 1058`: header `x=0…1488, y=0…65`; structure `x=0…327`; main scroller `x=327…1188`; tools `x=1188…1488`; no horizontal overflow and `window.scrollY=0`.

**Required fidelity surfaces**

- Typography: existing CenterWay UI, editorial and data fonts preserve the source hierarchy; the lesson heading, metadata and summary now use the reference's editorial scale and warm boundary rule.
- Spacing/layout: the three stable tracks, full-width header, centred `42rem` manuscript measure and bottom tool boundary match the reference composition. Sidebars do not participate in document scrolling.
- Colors/tokens: all surfaces, hairlines, guide/boundary states and selected rows use existing CenterWay material and semantic tokens; no local palette or new glass recipe was introduced.
- Image/assets: no new imagery was required. Existing CenterWay brand/avatar assets and the shared icon library are retained; no substitute CSS/SVG art was created.
- Copy/content: labels follow the implemented Ukrainian Builder vocabulary. Course and lesson wording intentionally comes from the live `test` DTO rather than copying the reference's example manuscript.

**Interactions tested**

- Module expand/collapse changes `aria-expanded` and restores correctly.
- Selecting the objective block switches the right rail from `Блоки` to `Властивості блоку`.
- Desktop and `409 × 844` mobile states have zero horizontal overflow; mobile removes both persistent rails and uses the existing bottom sheet.
- Browser console warnings/errors: none.

**Findings**

- No actionable P0/P1/P2 findings remain. Actual lesson content density varies with its DTO; this is an expected product-data difference, not layout drift.

final result: passed

---

## 2026-08-24 — internal workspace topbar

The supplied editor reference and final lesson workspace were compared in one
normalized input: `/private/tmp/builder-editor-shell-comparison.png`.

- Builder now requests the shared header's `workspace` mode instead of the
  public/learner floating-glass recipe.
- At 409 px after a 620 px scroll, the full-width header measures `top=0`,
  `bottom=65`, `width=409`, `radius=0`, `shadow=none`; window scroll remains
  zero and the local main scroller moves to `620`, with no header/tab overlap.
- At 1440 px the header remains full viewport width with no radius/shadow, the
  horizontal tab strip is absent, and course navigation remains in the desktop
  rail.
- Horizontal document overflow is zero in both captures.
- Evidence: `output/playwright/builder-workspace-topbar-mobile.png` and
  `output/playwright/builder-workspace-topbar-desktop.png`.

No actionable P0/P1/P2 findings remain.

final result: passed

---

# Design QA — restored immersive product card

## Evidence

- Selected target: the previously accepted photo-led product-card recipe; courses remain framed `16:9`.
- Verified capture: `/private/tmp/product-photo-card-restored.png` at the mobile marketplace viewport.
- Surfaces: the product rail on `/` and the product catalogue on `/products`.

## Findings and verification

- Product offers explicitly select `mediaPresentation="immersive"`; Course, Program and Test offers keep the default framed presentation.
- The product photograph fills the card, the existing contrast scrim protects the complete title/context/CTA stack, and the CTA remains outside the visual focal area at the card foot.
- The `/products` route renders the restored immersive card without changing the framed related-program cards immediately below it.
- No new palette, radius, shadow or gradient recipe was introduced; the restored card uses the existing Product Photo Card and DS tokens.

No actionable P0/P1/P2 findings remain.

final result: passed

---

## 2026-08-24 — workspace rail boundaries

- At 1645 × 1114 the header spans `x=0…1645`, while the footer is constrained
  to the central main column at `x=260…1420` (1160 px).
- The left rail remains stable at `y=65…1114` before and after the main column
  reaches its maximum scroll; `window.scrollY` stays `0`.
- In the lesson editor the open right properties rail remains stable at
  `y=65…1024`. At document end, the footer owns the main-column hit boundary
  (`x=330…1066`) and the properties drawer independently owns the right rail.
- Evidence: `output/playwright/builder-workspace-shell-1645.png`,
  `builder-workspace-shell-footer-1645.png` and
  `builder-tool-rail-footer-boundary.png`.
- Mobile header/footer remain on the existing 16 px content gutter and no
  horizontal overflow was introduced.

No actionable P0/P1/P2 findings remain.

final result: passed

## 2026-08-24 — course structure prototype

The live `/build/reset-day#course-structure` route was checked with its authored
course DTO in four bound states:

- `output/playwright/course-structure-rows-desktop.png` — default manuscript outline;
- `output/playwright/course-structure-rows-collapsed.png` — collapsed module with lesson-title preview;
- `output/playwright/course-structure-cards-wide.png` — optional two-column module overview;
- `output/playwright/course-structure-rows-mobile.png` — forced row hierarchy at 390 px.

The course title now acts as a running head, module/lesson folios carry the
hierarchy, desktop keeps day/block metadata visible, and the overview no longer
nests lesson cards inside module cards. All states use existing paper, ink,
hairline, editorial and data-font tokens. The 390 px course structure now holds
the intended 358 px content measure with 16 px viewport gutters after an
intrinsic-width regression was caught and fixed during browser QA. The
course-mode tab strip adds its own symmetric inner gutter, so the longer
`Публікація` label no longer consumes the right edge.

- Route: `/build/reset-day`
- Source visual truth: `/var/folders/sq/4w_d403s78l84cn2wzfq2djh0000gn/T/codex-clipboard-37f40bf2-865f-4c44-9dcf-34eb72927c29.png`
- Source state: current misaligned Builder reference, 1920 × 1080 px at 1× density
- Implementation evidence: `/private/tmp/centerway-builder-ink-final-desktop.png` (1920 × 1080 px, 1920 × 1080 CSS viewport, 1×), `/private/tmp/centerway-builder-ink-mid.png` (1280 × 800 px, 1×) and `/private/tmp/centerway-builder-ink-final-mobile.png` (390 × 2384 px full-page capture, 390 × 844 CSS viewport, 1×)
- Browser: Codex in-app Browser

## Visual comparison

The desktop source and implementation were opened in the same comparison input at the same 1920 × 1080 viewport. In the source the rail participates in layout: the document starts left of the topbar, its title is clipped above the bar and the structure uses only part of the available line. In the implementation the 1160 px topbar and 1160 px main share x=380, while the 248 px rail occupies the free left gutter at x=116. The implementation retains the quiet paper field, hairline rows, adjacent drag grips and restrained gold actions while removing the layout shift.

Focused evidence was needed for the new interaction assets. The current `Зміст` text state visibly carries the double ink line and minimal droplets at desktop, intermediate and mobile widths. The 1280 px capture shows the `Ряди` icon encircled by the open ink ring; the mobile menu capture `/private/tmp/centerway-platform-menu-ink-mobile.png` shows the same stroke under `Білдер` and the ring around the open menu control.

The mobile before-state and implementation were inspected together. The former stacked large rounded status and structure cards. The implementation now forces the row view, moves release readiness and blockers after the course structure, flattens their borders, and keeps the save row in normal flow. This preserves the paper metaphor without introducing a desktop rail at phone width.

## Interaction and responsive checks

- Course/content/release navigation works in both desktop rail and mobile text navigation.
- Course mode navigation has one contour per breakpoint: at 900 px the
  horizontal `Курс / Зміст / Публікація` strip is visible and the rail is
  absent; at 901 px the rail is visible and the horizontal strip is absent.
- Personal footer resolves to one 361 px column at a 409 px viewport and keeps
  its three-column 1160 px composition at desktop; brand and navigation no
  longer overlap on the Builder mobile route.
- Release opens as a right drawer on desktop and a bottom sheet on mobile. At 1920 px the main bounding box remained exactly `x=380, width=1160` before and after opening the drawer.
- Rows/cards selection works at desktop width; mobile always resolves to rows.
- Modules collapse and expand; module and lesson drag grips remain adjacent to their rows.
- The reference-module toggle is available from the module overflow menu.
- At 1920 px header/main are both `x=380, width=1160`; at 1280 px both are `x=60, width=1160`; at 390 px both are `x=16, width=358`.
- Mobile document width is 390 px with a 390 px scroll width: no horizontal overflow.
- Mobile structure ends before release readiness; the save row is static and does not cover blockers.
- Loading, loaded course, overlay-open, mid-desktop, mobile and mobile-menu states were browser-rendered without horizontal overflow.

## Intentional differences from the selected image

- The fixed implementation intentionally restores the course header that is clipped in the source screenshot.
- The active state is a visible irregular ink stroke instead of a browser focus rectangle or pale selected plate.
- At widths below the permanent-rail breakpoint, navigation moves into document flow; auxiliary sheets remain overlays.

## Verification

- `npm run lint` — pass.
- `npm run lms:validate` — 15 files, 186 tests passed.
- `npm run icons:check` — 54 glyphs and 6 graphics passed.
- `npm run tokens:build` — pass; the second generation was byte-identical (`globals.css` SHA-1 `34667b3…`, static token CSS `f436b01…`). `tokens:check` correctly reports the intended uncommitted generated-token diff against `HEAD`, not generator drift.
- `npm run build` — pass.
- `git diff --check` — pass.

## Comparison history

- P1 found: rail/grid shifted the document away from the topbar axis and clipped the course heading. Fixed by separating the rail from the content grid and using the shared platform container geometry. Post-fix evidence: 1920 px header/main bounding boxes match exactly.
- P2 found: the first ink graphic preserved a square symbol aspect ratio inside a wide label box, so only a short fragment rendered. Fixed by stretching only `ink-stroke` inside its baked SVG viewBox; icon glyphs and `ink-ring` retain their native aspect ratio. Post-fix evidence: full-width marks under `Зміст`/`Білдер` in desktop and mobile captures.

No actionable P0/P1/P2 findings remain. Typography uses the existing Cormorant/Manrope hierarchy; spacing follows the shared container; colors and hairlines resolve through existing semantic/material tokens; all non-standard marks are baked vector assets; app copy remains Ukrainian and unchanged except for existing state labels.

final result: passed

# Design QA — Builder course overview settings

## Target and evidence

- Route: `/build/reset-day#course-overview` with the authoring response mocked
  from the validated local course fixture.
- Captures: `output/playwright/course-overview-desktop.png`,
  `course-overview-mobile.png`, `course-overview-rhythm-mobile.png`,
  `course-overview-daily-mobile.png` and
  `course-overview-advanced-mobile.png`.
- Viewports: 1440 × 1024 and 409 × 1114.

## Findings

- The prior always-open form exposed template cards, storefront copy, schedule,
  theme, crop tools and technical access codes at the same hierarchy. The
  default surface now reads as four manuscript rows with one pencil each.
- Only one semantic row edits at a time. Schedule-dependent gate and reminder
  fields appear correctly after selecting `По днях`.
- Choice controls retain their shared touch geometry while their visual shape
  is reduced to text plus an active underline.
- Structure replacement and entitlement codes are available only inside the
  explicit `Додатково` disclosure; the template card grid is gone.
- Desktop keeps the persistent course rail and hides horizontal course tabs.
  Mobile keeps the tabs and single-column personal footer.
- Measured horizontal overflow and leaf overflow are empty in the default,
  rhythm, daily and advanced states at 409 px, and in the default state at
  1440 px.

No actionable P0/P1/P2 findings remain.

final result: passed

# Design QA — unified course media

## Reference

- User screenshots 2–3: old Builder upload preview and one-axis crop slider.
- User screenshot 4: selected landscape card frame and course-grid treatment.
- User screenshot 1: retired learner/profile edge-to-edge band treatment.

## Implemented target

- one framed 16:9 course cover across marketplace, Builder grid, learning shelf, and profile continue card;
- optional portrait master used only by the standalone course offer hero on mobile;
- 9:16 automatic crop of the landscape master when no portrait exists;
- Builder editor shows and directly edits both final formats instead of showing the uncropped upload and a range slider.

## Captured QA

### Marketplace

- Desktop screenshot checked at 1440×1000: image is inside the card, text is outside photography, rounded frame matches Builder direction.
- Mobile screenshot checked at 375×812: card remains landscape and does not swap to portrait media.
- Measured at 375, 768, 1024, and 1440: photo ratio is 1.778 at every breakpoint, radius is 16px, and page overflow is 0.

### Product page

- Mobile screenshot checked at 375×812: offer hero uses portrait framing; the existing landscape asset produces a viable automatic crop.

### Builder, learning, and profile

- Production build and TypeScript pass.
- Shared component/CSS contract is wired to all three surfaces.
- Visual capture is blocked because the available in-app browser has no authenticated local session and no authenticated external browser is connected.

## Gates

- `lint`: passed.
- `build`: passed.
- course-media targeted tests: passed (75 tests); full `lms:validate`: passed (18 files, 202 tests).
- `canon:guard`: passed.
- `guard:ds-contract`: passed.
- `guard:buttons`: passed after composing the reset action from the shared button contract.
- `semantic:audit`: blocked by a pre-existing unrelated invariant: missing `src/app/(platform)/herbs/page.tsx`.

final result: blocked

Blocking condition: authenticated visual capture of Builder, `/learn`, and `/profile` is still required before the Product Design visual gate can be marked passed.

---

# Design QA — product photo cards and horizontal video

## Source and implementation

- Source visual truth: `/var/folders/sq/4w_d403s78l84cn2wzfq2djh0000gn/T/codex-clipboard-d2906b40-cdca-4127-bffe-a493af692bc1.png`, 434 × 790 px at 1×.
- Mobile implementation: `/var/folders/sq/4w_d403s78l84cn2wzfq2djh0000gn/T/centerway-video-card-375-focused.png`, 375 × 812 px at a 375 × 812 CSS viewport and 1× density.
- Normalized comparison: `/private/tmp/centerway-video-reference-comparison.png`, source and implementation content regions scaled to the same 664 px height.
- Product implementation: `/var/folders/sq/4w_d403s78l84cn2wzfq2djh0000gn/T/centerway-products-375.png`, 375 × 2441 px full-page capture.
- State: public `/` orientation card and `/products` catalogue; no authentication required.
- Browser: Codex in-app Browser.

## Findings

The selected video-card composition is preserved: horizontal player first,
orientation label and editorial title below, then one primary action, one
secondary action, and the catalogue escape. The player is a distinct rounded
rectangle and does not carry the main copy or CTAs as overlays.

The product catalogue intentionally differs from the course-cover reference.
Its single current product uses an immersive photo-led card with the existing
DS contrast scrim, while related programmes remain framed 16:9 cards. This is
the requested semantic difference, not visual drift.

Required fidelity surfaces:

- Typography: existing CenterWay editorial/data/body stacks and Ukrainian copy are preserved; wrapping is equivalent to the reference at mobile width.
- Spacing and rhythm: media, label, title, body and actions follow the same vertical order; the 20 px video radius is visible on all four corners.
- Colors and tokens: no local palette, radius or shadow was introduced; both recipes resolve through existing platform/material tokens.
- Image quality: the supplied YouTube poster remains native and uncropped inside the player; product photography uses the authored focal position and cover treatment.
- Copy/content: the reference labels, title, explanatory sentence, actions and catalogue link remain unchanged.

Focused comparison was required because the source is a cropped component and
the implementation capture includes the surrounding page. The normalized
side-by-side comparison shows no actionable P0/P1/P2 visual mismatch.

## Responsive and interaction checks

- At 375 and 768 px, video ratio is 1.778, radius is 20 px, and horizontal overflow is 0.
- At 1024 and 1440 px, the former grid stretch was found and fixed; post-fix video ratio is 1.778 and `align-self` resolves to `start`.
- At 375, 768, 1024 and 1440 px, the product card remains immersive/full-photo and horizontal page overflow is 0.
- YouTube controls, fullscreen permission and the surrounding navigation/actions remain available.
- Browser console errors checked: no app-owned console error was observed during the public route captures.

## Comparison history

- P2 found: on desktop the two-column grid stretched the video to the height of the adjacent decision card, producing ratios from 1.23 to 1.38 instead of 16:9. Fixed by pinning the video panel to its own aspect-ratio height. Post-fix evidence measures 1.778 at 1024 and 1440 px.
- P2 found: mobile inherited top-only rounding from the previously joined media/text card. Fixed by giving the video panel the full DS radius; the final focused capture shows all four corners.

No actionable P0/P1/P2 findings remain.

final result: passed

---

# Design QA — mobile menu glass continuity

## Source and target

- Bug reference: `/var/folders/sq/4w_d403s78l84cn2wzfq2djh0000gn/T/codex-clipboard-aa873ae8-9225-48b2-8860-e9a7216e34d0.png`.
- Final mobile capture: `/private/tmp/centerway-menu-after-dark-home.png` at 390 × 844.
- Normalized comparison: `/private/tmp/centerway-menu-glass-comparison.png`.
- Semantic target: the open drawer is the expanded state of the current topbar glass, not a new light surface.

## Findings and correction

- P1: opening the menu re-sampled the full drawer backdrop and could change the resolved header tone from dark to light. The resolved tone is now frozen while the modal is open; background scrolling is already locked, so the sampled context cannot become stale.
- P2: the open sheet replaced the bar's 30% chrome tint with the 86% media tint, masking transparency and backdrop blur. The expanded sheet now uses the same token-sourced chrome tint as the closed bar; the existing scrim separates links from page content.

## Responsive and interaction proof

- 390 × 844 and 768 × 1024: closed and open states both resolve to `dark` on the photo hero.
- At both widths, closed and open pseudo-surfaces resolve to the same 30% background and `blur(20px) saturate(1.08)` filter.
- Body scroll locks while open and restores after Escape; no page or console errors were observed.
- Visual comparison confirms that the hero remains visible through the drawer and that no light flash or opaque cream sheet is introduced.

No actionable P0/P1/P2 findings remain.

final result: passed

---

# Design QA — Builder invalid-course recovery

## Evidence

- User reference: `/var/folders/sq/4w_d403s78l84cn2wzfq2djh0000gn/T/codex-clipboard-ce3b6e99-33a0-4e29-a1e7-50bfb920abe4.png`.
- Reproduced before-state: `/private/tmp/builder-error-before.png` at 370 × 730.
- Verified recovered state: `/private/tmp/builder-error-after.png` at 370 × 730.
- Route and state: authenticated `/build/test`, invalid stored daily schedule.

## Findings and correction

- P1: two lessons shared `day_index = 5`; the new lesson was moved to the next free day, `6`. A post-write query reports days `1, 2, 3, 4, 5, 6, 11` and no duplicates.
- P1: the course GET endpoint classified an LMS validation failure as a network `500`. LMS contract errors now return `422`, so the Builder selects its invalid-content state.
- P2: raw `lms_*` identifiers were rendered as primary user copy. Known duplicate-day failures now have a plain-language explanation; internal codes and database details stay out of network error copy.
- P1: the unbroken identifier expanded the grid item to 524 px in a 370 px viewport. Builder panels and their text now permit intrinsic shrinking and emergency wrapping.
- Recovery: network failures now include the existing quiet-action recipe for retrying the request.

## Verification

- After recovery, `/build/test` opens the course at 370 px with `document.scrollWidth = 370` and shows «Урок 1» as day 6.
- The course editor, navigation, lesson links and save state are present in the rendered DOM.

No actionable P0/P1/P2 findings remain.

final result: passed

---

# Design QA — unified immersive marketplace cards

## Evidence

- Selected reference: `/var/folders/sq/4w_d403s78l84cn2wzfq2djh0000gn/T/codex-clipboard-93f0dc0c-47d8-4112-bfa5-46fd53d39dfa.png`.
- Product result without points: `/private/tmp/marketplace-products-clean.png`.
- Program result: `/private/tmp/marketplace-programs-immersive.png`.
- Test result: `/private/tmp/marketplace-tests-immersive.png`.
- Reference/result comparison: `/private/tmp/marketplace-all-cards-comparison.png`.

## Findings and correction

- P1: the framed override made Courses, Programs and Tests visually diverge from the selected earlier marketplace language. Removing that override restores the existing full-card photo and DS contrast scrim for every `PlatformOfferCard`.
- P2: the herb card placed three long context bullets over the photograph. Both marketplace renderers now keep only its short description and CTA; detailed fit/boundary content remains available to the product detail flow.
- Course identity outside discovery is unchanged: Builder, learner shelf and profile continue cards still use their dedicated framed `16:9` `CourseCover`.

## Verification

- `/programs`: mini-courses and long programs render as immersive photo cards.
- `/tests`: active and planned tests render in the same immersive card family.
- `/products`: the herb card has no list and the related programs use the same full-card recipe.
- Mobile captures show readable contrast, one CTA per card and no horizontal page overflow beyond the intentional snap rail.

No actionable P0/P1/P2 findings remain.

final result: passed
