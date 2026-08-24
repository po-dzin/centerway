# Course media contract — 2026-08-24

## Decision

Course identity uses one shared landscape cover object everywhere a course is
shown as a card. A portrait image is not a second cover; it is an optional
mobile-only hero asset for the standalone course offer page.

| Surface | Semantic role | User question | Frame | Source |
| --- | --- | --- | --- | --- |
| `/programs` catalogue | offer / orientation | What is this course? | 16:9, inside the card frame | `cover.src` |
| `/build` course grid | authoring orientation | Which course am I editing? | 16:9, inside the card frame | `cover.src` |
| `/learn` shelf | progress / route | Which course do I open? | 16:9, inside the card frame | `cover.src` |
| `/profile` continue card | progress / next step | What do I continue now? | 16:9, inside the card frame | `cover.src` |
| `/programs/[slug]`, tablet and desktop | offer orientation | Where did I arrive? | existing horizontal hero | `cover.src` |
| `/programs/[slug]`, mobile only | offer orientation | Where did I arrive? | portrait hero | `cover.mobileSrc`, falling back to a 9:16 crop of `cover.src` |

Token source is the global application design-system delivery layer. Content
source is the authored `lms_courses.cover` JSON object. Route boundaries do not
change: catalogue, personal learning, authoring, and offer routes keep their
existing actions and navigation.

## Data shape

```ts
cover: {
  src: string;
  alt: string;
  cropX?: number;
  cropY?: number;
  mobileSrc?: string;
  mobileCropX?: number;
  mobileCropY?: number;
}
```

All focal-point values are integer percentages from 0 through 100. Existing
records with only `cropY` remain valid; missing axes default to 50.

## Authoring behavior

The Builder does not show the uncropped upload as the main preview. It shows
the two actual outputs:

- a 16:9 landscape card preview shared by marketplace, Builder, learning, and profile;
- a 9:16 mobile hero preview that uses the landscape image until an optional portrait master is supplied.

Both previews are edited directly by dragging the focal point. Keyboard arrows move
the focal point, `Shift` increases the step, and “По центру” resets the active
format. The old one-axis range slider is retired.

## Responsive invariant

Card media never swaps to the portrait source at mobile breakpoints. Only the
standalone offer hero may use `mobileSrc`; this prevents the same course from
changing identity between catalogue, purchase, learning, and profile.

## Marketplace and video media recipes

Marketplace discovery uses one atmospheric offer-card recipe for Products,
Programs, Courses, and Tests: the existing horizontal artwork fills the card
and copy sits on the DS contrast scrim. This is a presentation rule of the
public catalogue, not a change to the underlying course-cover asset.

Builder, learner shelf, and profile continue cards still render that same course
cover as a framed `16:9` identity image. The immersive catalogue card never
switches to the portrait hero source on mobile.

Video is a third, non-interchangeable media object. Public orientation video,
learner lesson video, and Builder block preview use a horizontal 16:9 player in
a rounded DS frame. The player preserves 16:9 even when adjacent desktop copy
is taller; mobile presents it as a distinct rounded rectangle inside the
containing card. Video never inherits portrait hero behavior.

## Verification

- course schema validation accepts both focal-point pairs and rejects values outside `0..100`;
- lint and production build;
- browser QA at `375`, `768`, `1024`, and `1440` for Builder, catalogue, learning shelf, profile continue card, dynamic course offer, product cards, and public orientation video.
