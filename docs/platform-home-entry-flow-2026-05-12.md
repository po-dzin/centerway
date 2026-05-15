# Platform Home Entry Flow Note — 2026-05-12

## Scope

Public platform home `/`.

## Decision

The former split between:
- intro / video block;
- standalone diagnostics route-choice block;

is collapsed into one entry surface.

Current home entry flow is:
- `hero`
- `intro + first step`
- `mini-courses`
- `programs`
- `natural support`
- `proof`
- `author`

## Rationale

The separate diagnostics block duplicated the same semantic question already introduced by the intro card and created unnecessary rhythm break between orientation and first action.

The merged surface keeps the platform-hub rule:
- one center of gravity per screen slice;
- one clearer next-step cluster;
- less duplicated explanatory copy.

## Runtime Implications

- `platform-home.route-map` removed from `screen_manifests.json`
- `route_family.platform-hub.v1` no longer requires `route-map` as a mandatory role
- diagnostics actions now live inside the intro card as two route-choice CTAs:
  - dosha test
  - consultation

## Visual / Layout Implications

- video panel no longer stretches against the text card height on desktop/tablet
- intro section now owns both orientation and first diagnostic choice
- mobile keeps the stacked combined card rather than separate intro + diagnostics sections

## Canon Promotion Status

Local only for now.

If this merged entry pattern becomes the durable rule for future platform hub screens, promote the minimum contract update into RAverse UI-UX / blocks canon.
