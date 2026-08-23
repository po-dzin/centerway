# Builder course workspace — design QA

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
