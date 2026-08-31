# Author showcase audit — 2026-08-30

## Scope

- Surface: public author showcase at `/expert/[slug]`.
- User question: who is this educator, why should I trust the course context, and what can I learn from them here?
- Semantic role: author identity and proof, followed by the course showcase.
- Content source: `lms_authors` identity fields and courses attributed to that author.
- Token source: existing platform layout, material, type and interaction tokens; no local visual recipe is introduced.
- Route boundary: `/expert/[slug]`; course detail remains its own route.

## Current evidence

The supplied public-page screenshot shows three unrelated blocks: a detached wide background, a portrait/name cluster and a separated course section. The empty profile fields make the separation more visible: a large blank identity field, then a separate stats rule, then an empty showcase.

## Builder research synthesis

- Teachable and Kajabi use one instructor block composed of image, name/title, short bio and credentials, reused beside the course rather than treated as a separate decorative destination.
- Circle treats a cover as a bounded header asset with its own crop, not a canvas under every profile field.
- Webflow portfolio guidance keeps a brief person-centred introduction before a curated work list; projects should not compete with the introduction.

Sources: Teachable instructor bio/Page Editor 2.0 and author docs; Kajabi instructor information docs; Circle cover-image docs; Webflow portfolio guidance (all checked 2026-08-30).

## Recommended composition

1. One material author card. Its top 16:5 cover is an optional atmosphere layer, clipped inside the card.
2. A compact circular portrait overlaps the lower edge of that cover; name, role and one-sentence promise begin beside it.
3. Below, a two-column content body: a fixed, compact identity/proof rail on the left and the bio/quote/credentials on the right. Hide absent fields rather than reserving empty vertical space.
4. The course shelf begins directly after the card. When it is empty, show one quiet sentence in the card's footer rather than a separate showcase region and a stat row with `0`.
5. Keep only data that answers a reader's decision: role, meaningful credentials, and published courses. Omit generic `Статус` unless it carries actual public meaning.

## Interaction note

No new interactive control is proposed. Existing navigation links retain their current interaction family; any future selected segmented control must declare `selection_family` and use the platform ink component.

## Accessibility verification gap

The screen screenshot alone cannot confirm focus order, keyboard disclosure behaviour or contrast ratios. The revised card must preserve semantic heading order, use alt text for the portrait, mark the decorative cover hidden, and be tested with live content at desktop and mobile widths.
