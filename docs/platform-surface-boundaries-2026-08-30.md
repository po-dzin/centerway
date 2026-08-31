# Platform / library / Builder — boundary audit, 2026-08-30

## Evidence and limits

The supplied five screenshots cover workshop toolbar/cards, library loading,
public catalog and cabinet author form. They show the user's actual mismatch:
48px scrim behind a smaller ink hover, rectangular author-status badges,
outlined library cards, double-edged loader, strong command boundaries.

Live public `/programs` was captured and inspected in the in-app browser:
`/tmp/centerway-surface-audit-2026-08-30/01-platform-programs.png` and
`02-platform-catalog.png`. The public photo cards already separate through
imagery and shadow, and their type badges are capsules. Preserve this recipe.

Live `/build` required sign-in. No authenticated visual acceptance of library,
Builder or cabinet is claimed. Their current implementation was inspected;
supplied screenshots are the visual evidence. No auth bypass, database writes,
new public fixture route or changes to course content were made.

## Diagnosis

1. `[data-cw-material]` applied both an outer stroke and an inset ring to every
   material consumer. Material choice had accidentally become boundary choice.
2. `secondary`, search, popover and its divider reused the strong checkbox
   stroke. Many unrelated edges competed at the same intensity.
3. Builder menu scrim filled its entire 48px touch target. The actual hover
   ring is scaled and has optical padding inside the SVG viewBox.
4. Library draft chip used a glass-panel recipe; Builder used a local scrim
   with inset (rectangular) radius. The same status had two visual grammars.
5. The icon+text rule was too broad: a navigation row can remain a text choice;
   an actual command needs a single whole-control boundary.

## Semantic contract before implementation

| Components | Role / user question | Selection family | Boundary | Content / routes |
|---|---|---|---|---|
| Shared secondary, ShelfFilter | method: what action / category? | contour trigger; hybrid options | quiet commands; essential checkbox | Existing labels/query; `/learn`, `/build`, shared platform consumers |
| Library CourseCard / CourseRow | progress: which material and next step? | existing action/link semantics | none at rest | Existing learner API, routes unchanged |
| Builder card overflow | method: what else can I do with this material? | ink, icon-only | compact scrim, no contour | Existing menu/actions, `/build` |
| Cover badges | orientation: draft or published? | none, not interactive | borderless capsule | Existing course status |
| PlatformLoadingState | orientation: is content loading? | none | no decorative edges | Existing route loading labels, lifecycle unchanged |
| Public offer cards / cabinet structure / topbar | offer / orientation | existing | retain established material/chrome edges | No content or route changes |

Sources: shared RAverse canon; `cw.tokens.json`; app/global material and ink
delivery; existing account-menu marks. No new palette, type scale or ink asset.

## Implemented

- Separate `data-cw-edge="none"` from material. Remove both edges while
  retaining grain, shadow and box geometry; library cards/rows and loader opt in.
- Keep moderate cabinet structural panels and public/chrome surfaces unchanged.
- Add quiet stroke token in both themes; consume it in shared secondary,
  search and filter overlay. Keep strong checkbox token and focus feedback.
- Use the common faded divider inside the filter. Keep its count slot and
  disable hover lift so filtering cannot move the trigger under the pointer.
- Share the photo-status capsule between library and Builder, including the
  published variant's base composition. Existing safe scrim contrast retained.
- Paint overflow scrim at the optical hover diameter, leaving the 48px target
  and shared selected/hover ink drawing unchanged.
- Clarify text-choice versus labelled-command rules in the DS and require
  agents to declare the boundary role via `AGENTS.md`.

## Verification

- Targeted interaction/filter/surface contracts: 16 tests passed.
- Lint, button contract, DS contract, contrast guard: passed.
- Full tests: 77 files / 756 tests passed. Production build passed (102 pages).
- React review: presentational attributes and shared CSS composition only;
  no new hooks, data fetching, client dependencies or changed action semantics.
- Remaining manual acceptance: authenticated desktop/mobile filter selection
  (0→1→3→0), hover/open overflow, loading, both themes and profile controls.

## Scope boundaries / follow-up debt

The spatial library room intentionally uses a separate authored paper/room
renderer. It still contains inherited prototype palette literals; these were
not silently recolored as part of the card-boundary fix. It needs its own
theme/contrast review before claiming every runtime style is token-unified.
The audit does not claim all app routes have received authenticated visual QA.

This durable boundary-role rule was mirrored in the shared `Дизайн-токены.md`
canon (with approved access), including the clarified icon+text semantics.
