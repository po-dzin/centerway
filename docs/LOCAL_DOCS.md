# Local Docs Storage

## Purpose

This file is the compact entry point for the repository-local documentation layer.

It answers three questions:

1. which docs stay active in the repo root;
2. where archived operational notes live;
3. where to put the next local note so `docs/` does not sprawl again.

`RAverse/ReOS/Projects/CenterWay/**` remains the semantic and governance source of truth.
This file only governs the local storage layer inside the repo.

## Active Root Set

Keep only these files in the root of `docs/`:

- `docs/CANON.md`
- `docs/LOCAL_DOCS.md`
- `docs/platform_agent_preflight.md`

Keep these root directories:

- `docs/migration/`
- `docs/legacy/`
- `docs/archive/`

Everything else should either:

- move to `docs/archive/**`, or
- be promoted into RAverse if it becomes durable cross-project canon.

## Archive Layout

Use these archive buckets:

- `docs/archive/working-notes/`
  task-local, dated, implementation-phase notes
- `docs/archive/reference/`
  derived extracts, generated or hand-curated reference material
- `docs/archive/ops/`
  operational notes that are useful for provenance but do not need to stay active

Current examples in `docs/archive/reference/`:

- product-specific landing bridge notes
- legacy-to-RAverse comparison maps
- derived extracts that should stay available but not remain in active preflight

## Placement Rules

### Put a file in root `docs/` only if all are true

- it is part of the active repo-level operating loop;
- it is expected to be reused frequently across tasks;
- it is not just evidence for one implementation wave;
- it should stay visible during ordinary preflight.

### Put a file in `docs/archive/**` if any are true

- it is date-stamped and tied to one work wave;
- it is exploratory, comparative, or audit-heavy;
- it is a derived export or handoff artifact;
- the main decision already lives in RAverse or in runtime code.

### Promote to RAverse if all are true

- the rule is durable;
- it affects more than one route, component, script, or migration;
- it should guide future work beyond one immediate implementation cycle.

## Working Rule

When adding a new local doc:

1. decide whether it is active, archived evidence, or shared canon;
2. default to `docs/archive/**` unless there is a strong reason to keep it active in root;
3. update this file only when the storage policy or active root set changes.
