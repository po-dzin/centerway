# LMS reader navigation — mobile baseline

## Contract

- Surface: learner lesson and the same renderer inside Zen Preview.
- Semantic role: orientation + progress.
- User question: how do I open the course map, and which adjacent lesson can I actually visit?
- Token source: existing LMS/platform button and material recipes.
- Content source: lesson navigation DTO and course outline.
- Route boundary: personal `/learn/**`; draft preview preserves its Builder `returnTo`.

## Behaviour

`Зміст` has one stable position above the lesson title. The footer renders only
real sequential neighbours: reference and one-lesson pages have no pager; the
first and last lessons show one full-width destination; middle lessons show
both neighbours. Missing neighbours are never replaced with course contents.

## Validation

- Unit matrix: `src/lib/lms/lessonNavigation.test.ts`.
- Browser QA covers reference, first, middle and last lesson states in Zen Preview.
