# LMS reader navigation — mobile baseline

Status: local implementation decision, pending longer-term product validation.

## Contract

- Surface: learner lesson and the same renderer inside Zen Preview.
- Semantic role: orientation + progress.
- User question: how do I open the course map, and which adjacent lesson can I actually visit?
- Token source: existing LMS/platform button and material recipes.
- Content source: lesson navigation DTO and course outline.
- Route boundary: personal `/learn/**`; draft preview preserves its Builder `returnTo`.

## Behaviour

`Зміст` has one stable position above the lesson title and opens the existing
course drawer. The footer renders only real sequential neighbours:

| State | Footer |
| --- | --- |
| Reference page | hidden |
| One sequential lesson | hidden |
| First lesson | next only, full width |
| Middle lesson | previous + next |
| Last lesson | previous only, full width |

A missing previous or next lesson is never replaced with a link to course
contents. Reference pages remain outside the sequential lesson count.

## Validation

- Unit matrix: `src/lib/lms/lessonNavigation.test.ts`.
- Manual mobile QA: 390 × 844 in Zen Preview.
- Verified states in `ideal-body`: reference (`recipes`), first (`lesson-1`),
  middle (`lesson-11`), and last (`lesson-21`).
