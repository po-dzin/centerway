# Builder — one menu, two subjects

Status: implemented 2026-08-29. A row menu can now name what each run of items
acts on, and the block editor's document rhythm was widened to hold its own
controls.

## Contract

- Surface: builder lesson document (`/build/[course]/[lesson]`), the rich-text
  block and its paragraphs.
- Semantic role: boundary — telling apart two objects that occupy the same
  place on screen, so a destructive action names its own target.
- User question: *does this delete a sentence, or the whole block?*
- Token source: existing builder ink and rule recipes plus
  `--cw-mat-stroke-chrome`; the caption reuses `.slashGroupTitle`'s recipe. No
  new visual token.
- Content source: none — this is authoring chrome over the author's own
  document.
- Route boundary: builder only; the learner renderer has no row menus.

## The problem

A rich-text block draws no rail of its own. That was decided deliberately: the
block CONTAINS its paragraphs, so a block rail plus a node rail put three «…»
on screen at two indents, all the same glyph, with nothing saying which one
deleted a sentence and which one the block. The block's four actions were
handed to the nodes instead.

The cost was a single flat list of eleven items with two different subjects in
it:

| Items | Acts on |
| --- | --- |
| Абзац / Підзаголовок / Список / Нумерований список | what THIS paragraph *is* |
| Підняти вище / Опустити нижче / Видалити | THIS paragraph |
| Властивості блоку / Підняти блок вище / Опусти́ти блок нижче / Видалити блок | the BLOCK holding every paragraph |

One hairline separated the second run from the third. That is enough to say
«a break» and not enough to say «a different object», so «Видалити» and
«Видалити блок» were two lines differing by one word — and the word was the
difference between losing a sentence and losing the block.

## The contract

`MenuItem` gains an optional `section: string`.

- Consecutive items carrying the same `section` are gathered into a
  `role="group"` with that string as its `aria-label`. The visible caption is
  `aria-hidden`, or the subject is announced twice before the first item.
- The caption **is** the separator: a section-leading item does not also draw
  `startsGroup`'s rule, or the group gets a double edge.
- `startsGroup` keeps its old job — a break between items with the SAME
  subject. In the node menu it still separates «what this is» from «what to do
  with it».
- Grouping is by consecutive run, never by gathering. The order the caller
  wrote is the order the author reads; re-sorting a menu so two same-named
  items sit together would move actions out from under a finger that has
  learned where they are.

`section` is absent wherever a menu has one subject — the lesson row, the
module head, the course card, a non-prose block's own rail. A heading over four
things that obviously belong together is furniture.

Sections are named for the object, not the action: «Цей абзац» / «Цей список»
for the node (all four kinds are masculine, so «Цей» agrees), and
«Блок «Текст»» for the block, taking its name from `BLOCK_TYPE_LABELS` rather
than saying the bare word «блок».

## Height

A grouped node menu is eleven 48px rows under two captions — about 590px. The
placement code clamped only `top`, so on a landscape phone or a short laptop
the tail went off the bottom of the screen and the last item, the destructive
one, was unreachable.

The list is now capped by the room it actually has: the roomier side of the
trigger, never below `MIN_HEIGHT` (168px) and never above the viewport, and it
scrolls inside that. Roomy viewports are unaffected — a 900px screen still
draws all 590px with no scrollbar. A scroll originating inside the list no
longer closes the menu; the capture-phase listener that closes on page scroll
now ignores its own list.

## Handles and gaps

Two related changes to the same document, in the same pass.

**The handles moved to the leading gutter.** They have been on both sides. The
objection that sent them to the trailing side was that the rail sat in the
block's own margin, sharing a strip with the text, so a drag starting slightly
too far in grabbed the block instead of placing the caret.
`--builder-doc-gutter` is a reserved 3rem OUTSIDE the measure on both sides,
and nothing in it is on the way to a word. Mobile takes the same side, so the
handle does not change edges when the layout does.

**The insert gap is floored at the control's own size.** The `+` ring is
`--ds-touch-target-min` (48px); the gap was `--cw-course-block-gap` (16px by
default, 12px compact). Taking the ring out of flow centred it on the rule and
left it overhanging 16px above and below — and 16px above the list's own top at
the head of the document. An out-of-flow 48px control still paints 48px, so
only the gap can fix it:

```css
min-height: max(var(--ds-touch-target-min), var(--cw-course-block-gap, var(--cw-space-md)));
```

`--cw-course-block-gap` is deliberately NOT raised. It is the learner's reading
rhythm, shared with the course renderer; loosening every lesson on the shelf to
make room for an authoring control would be the tool changing the work.

## Canon

Local implementation detail. The shared canon already says blocks are called
through inline `+`, `/` at the caret, or the right-hand group from one registry
(`UI-UX канон.md`, material grammar of light working surfaces); none of that
changes. `MenuItem.section` is a component API, not a new block taxonomy or a
new visual role — the caption borrows the slash palette's existing recipe.

No RAverse update in this pass. If a second surface outside the builder adopts
subject-named menu groups, the rule becomes durable and belongs in
`Блоки и компоненты.md`.
