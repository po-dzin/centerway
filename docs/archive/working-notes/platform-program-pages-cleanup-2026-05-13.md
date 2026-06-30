# Platform Program Pages Cleanup 2026-05-13

## Scope

- `/programs/way21`
- `/programs/ideal-body`
- `/programs/irem`
- `/mini-detox`

## Semantic decision

Platform program pages are treated as direct selling surfaces, not teaser bridges into separate program landings.

## New composition

1. visual-first hero
2. condensed result/format block
3. local enrollment form
4. boundary block

## Why

The previous generator assembly repeated one `offer.info` renderer across multiple semantic roles (`route-framing`, `offer-definition`, `offer-includes`, `format-price`, `how-it-works`, `proof`), which produced visible duplicate sections and weak CTA logic.

## Runtime change

- program-family routes now use the same overlay platform shell reference as home;
- screen manifests for platform program pages were reduced to:
  - `hero`
  - `offer-definition`
  - `support`
  - `boundary`

## CTA rule

Platform program pages no longer send the primary action to separate program landings. Primary CTA stays inside the platform route and points to the local enrollment surface until payment integration is connected.
