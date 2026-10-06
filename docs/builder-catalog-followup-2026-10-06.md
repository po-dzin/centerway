# Builder / catalogue follow-up — 2026-10-06

## Contract and scope

Local routes `/build/**`, related admin product editing and generated landing format copy.
No production publishing or schema changes in this cycle.

- Back controls: route command, “where do I return?”, selection_family `contour`, quiet boundary inside structural chrome. Arrow only at course/lesson level in both viewport classes; destination remains accessible. Existing global platform foreground and organ tokens.
- Tabs: orientation, “which workspace is open?”, selection_family `ink`, structural strip. Shared ink label paint is unchanged; vertical overflow is clipped.
- Block/paragraph menus: method commands, “what can I do with this content?”, selection_family `ink`, quiet popup. Existing document gutter and touch geometry; menu at trailing upper corner, drag grip at leading edge.
- Format editor: configuration, “how do I change this format?”, selection_family `contour`, structural panel. Existing offer data and platform tokens. Opening moves focus and scroll to the form.
- Document tail/title: readable/editable content, no new selection family or boundary. Existing spacing/type tokens. Compact end padding uses the small spacing token; desktop writing room remains. Title height tracks width and font readiness.
- Landing bundle note: reading/support, no control/boundary. Existing landing typography and bundle data; program title is plain text rather than an exit to platform formats. Bonus images unchanged.

## Closed

Arrow-only Builder back navigation; neutral foreground response on quiet topbar controls; no ink circles on chevrons; corner overflow menus on blocks and paragraphs; no vertical tab scroll; short saved state; compact mobile document tail; responsive multiline title height; format editor focus/scroll.

A course-owned format no longer appears again in standalone product pricing. Server writes and activation changes from that obsolete product entry return `product_is_course_format` (409), preserving the course editor as its authority.

## Audit gaps that remain

1. Early pricing is not implemented in this branch. Current countdown concerns cohort start, not an early-price expiry. There are no distinct early amount/deadline fields. This needs one effective-price contract shared by checkout, platform, landing and both editors, with expiry behaviour.
2. Builder access term still accepts legacy free prose. Only known numeric presets/lifetime map to access rules; arbitrary text does not define a duration. Replace this ambiguity with numeric days/lifetime and reconcile existing data.
3. Admin format review has a price form for pending proposals, not complete editing of every approved format's amount, purchase/application mode and duration. The fully unified “prices and access” flow is not finished merely by removing duplicate standalone products.

Current local data is a snapshot: self/group are checkout and individual is lead; no featured format is selected. Price, launch date and bestseller values were not changed in this audit.

## Verification

Browser: local native Supabase and port 8000, compact 340×1100 and desktop 1360×900. Back routing works, block menu occupies the trailing corner, format edit scrolls/focuses its region, tab items have no vertical scroll range, multiline title reflows, mobile save row follows the final block without a half-screen spacer.

Targeted tests, lint, typecheck and production build results are recorded at cycle completion below.

Cycle checks: 28 targeted test files / 304 tests pass; `npm run lint` completes
with one existing navigation warning in PlatformAccountMenu; `npm run typecheck`,
`npm run build` (102 routes, local native database reachable),
`npm run guard:ds-contract` and `git diff --check` pass.

Compact course-tab spacing follow-up: the hidden course command row still made a
zero-height grid track and therefore an extra grid gap. Hide that row at ≤900px
and remove course-page top padding; retain the shell's chrome clearance. Tabs
are orientation / selection_family `ink`, structural boundary, existing global
spacing and current course-mode labels, `/build/**`. No control paint, reading
content, desktop or lesson spacing changes.

Course shelf row parity: Builder and admin catalogue now use the existing
portrait crop (4:5, standard thumbnail width) with overflow at the upper trailing
corner. Course rows are collection objects (boundary none); overflow is a method
command, selection_family `ink`, quiet popup. Content comes from course/cover
data, tokens from shared card and spacing roles. Builder retains its action menu;
admin course actions move into its existing accessible native popover alongside
full row information. Other admin rows and the Builder large-card view are unchanged.

Row-parity verification: mobile and desktop browser checks confirm portrait
thumbnails and fixed corner placement in both catalogues; native admin popover
opens/closes and preserves actions. 38 targeted tests pass; lint has only its
existing PlatformAccountMenu warning; typecheck, production build and admin
UK/EN i18n/tone guard pass.

Corner optical correction: the shared inset aligns the visible glyph, not the
outer touch box. Offset the box by half its unpainted margin using existing
`ds-touch-target-min` / `ds-icon-in-control` tokens in Builder and admin. The
selection_family remains ink, quiet command popup; no ink drawing or touch target
changes. Learner library rows have progress at the trailing edge, no overflow menu.
