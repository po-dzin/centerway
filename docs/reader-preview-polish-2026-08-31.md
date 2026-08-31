# Reader / preview polish — 2026-08-31

## Preflight

This is implementation alignment with the existing UI-UX author-preview canon,
not a new route, content, or theme contract. The shared canon and local DS take
precedence over UI/UX Pro Max recommendations.

| Component | Surface / semantic role / user question | Sources / boundary / selection family |
|---|---|---|
| ReaderChrome and ZenPreviewShell | Library and Builder preview; orientation/route; how do I return and access reading tools? | Existing reader controls and saved-draft copy; shared LMS chrome material, spacing, touch and reveal; `/learn/**` preview retains `/build/**` origin; structural toolbar, contour command |
| Contents / note panel / size menu / mark toolbar | Library reader and author preview; orientation/support; what can I read or annotate? | Existing course/annotation data; shared material deep/raised shadows; existing overlay boundary unchanged, no new palette or selection marks |
| Sidebar append commands | Builder; route/command; where can I add a lesson or module? | Existing callbacks/copy; `PlatformButtons` base + secondary + hug, quiet boundary, contour; no data or route changes |

## Causes and fixes

- Preview already reused LessonView but added a separate narrow header above its
  floating toolbar. Removed that stacked header. ReaderChrome owns the row in
  ready/loading/error states; the labelled author return replaces the learner
  back action and is one full button, without duplicate saved-draft status.
  The shell provides the same row on the course preview. Existing saved history
  return and preview query propagation are preserved.
- Both islands use the reading column's 46rem measure in preview and ordinary
  library reading, instead of drifting to the viewport corners on wide screens.
- Four overlays calculated shadows from platform text. Dark text becomes light
  in dark mode, turning those shadows into halos. Switched contents/note editor
  to deep material elevation and smaller tools to raised elevation. Gold button
  glow is unchanged.
- Sidebar append controls used `--cw-platform-accent-strong` (`#0f0f0e` in the
  dark palette). They now compose the common labelled command with theme-aware
  foreground and a quiet outline. Touch targets remain at the DS minimum.
- Safe-area clearance is shared by the floating toolbar and reading column.

## Verification

- Production build passed (102 static pages), lint passed.
- All 80 unit suites / 769 tests passed, including five new reader contracts.
- Button and DS guards passed; whitespace diff check passed.
- Browser: dark-mode preview return checked at 375×812, actual target 48×48,
  foreground `rgb(228,228,225)`, status text 14px; no extra top header.
- The browser had no author session and reached the sign-in state. Real draft
  content, open contents panel and sidebar append behavior were not visually
  exercised under authentication; no auth bypass or data mutation was used.
- UI/UX Pro Max informed contrast/safe-area/target checks; the React review
  retained unconditional hooks, effect cleanup and existing progress guards.

## Canon impact

No new invariant: shared renderer, one preview return boundary, token-driven
elevation and theme-aware controls already belong to the active canon. This
local note records their corrected implementation. The earlier notification
canon promotion remains separate and pending because external writing was
rejected by the execution environment.
