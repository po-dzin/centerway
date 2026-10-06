# Builder ink controls — 2026-10-05

Builder navigation and quiet icon choices use the shared ink primitives
instead of local ring CSS or a filled hover state. Disclosure chevrons and
document topbar commands use foreground feedback without ink rings. The selection family for navigation and quiet choices is `ink`; panels, menus, cards,
and destructive actions retain their structural or semantic surfaces. Their
token source remains the global platform interaction and material tokens.

The document-level Builder topbar is the deliberate exception: preview, version
history, and lesson contents are commands, not mode choices. Their
`selection_family` is `contour` for keyboard focus; pointer hover and expanded
state change only the foreground to `--cw-platform-text`, from the muted resting
color. The light surface has no distinct accessible warm hue for small text and
icons, so guide green is reserved for guide meaning and gold is not used as a
text color. The surrounding capsule provides the surface and touch area, so
these controls do not draw an ink mark, individual outline, or hover plate.
Every icon-only command in that capsule uses the shared square button geometry,
keeping its glyph centered and the cluster balanced; the preview command
restores the shared label padding on desktop.
The course/lesson navigation is `selection_family=ink`: hover and current
states use the shared ink rule under the label, and the label changes to
`--cw-platform-text`. The selected tab is never colored guide green. The
Builder back action is `selection_family=contour`; its existing island
stays in place while the arrow takes the same deep neutral ink on hover
and keyboard focus. Other platform routes keep the shared organ geometry and
inherit the same foreground response.

Builder disclosure chevrons do not carry `InteractionInkIcon` rings. Their
open state remains legible through direction/rotation and the deep neutral
foreground; pointer hover uses that same color. A row that has a text label
keeps the shared ink mark on that label only.

The mobile Builder chrome declares a fixed light tone because its canvas is
light regardless of the content currently under the floating islands. Course
and lesson save status at rest reads `Збережено`; pending-save and staged
revision messages still explain their distinct states. The course save bar no
longer adds a second top divider.

Route boundary: `/build/**`. No schema or public-page behavior changed.

## Follow-up — 2026-10-06

Course and lesson back controls are arrow-only, with their full parent
destination preserved in aria-label/title and the flush-aware navigation callback.
Desktop and mobile both show only the arrow; the document title supplies context.
Block and rich-text paragraph menus occupy the trailing upper corner at both
viewport classes. Drag grips retain the leading edge; the spanning desktop rail
does not intercept clicks in the text. Touch layouts expose menus without hover.

The horizontal course strip hides vertical overflow, and its tab items clip the
empty extent of the shared ink SVG without changing its paint/geometry. It no
longer has a vertical scroll range.

Preflight: back = route command, “where does this leave the editor?”, contour /
quiet; tabs = orientation, “which course workspace?”, ink / structural strip;
block/paragraph menus = method commands, “what can I do with this content?”,
ink trigger / quiet popup. Tokens: global platform foreground, shared organs,
DS touch target, existing Builder document gutter and shared ink. Content: current
trail and course/lesson data. Route boundary: /build/**; shared back foreground
response also applies to existing platform back islands.
