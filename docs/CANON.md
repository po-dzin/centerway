# CenterWay Canon Policy

## Purpose

This repository keeps derived operational documentation, implementation notes, migration records, runtime contracts, guard scripts, and local evidence.

The shared canon store lives outside this repository:

`/Users/G/Documents/RAverse/ReOS/Projects/CenterWay`

That store is the only semantic and governance source of truth. It owns product semantics, role taxonomy, token ontology, block taxonomy, route families, IA boundaries, and brand/legal/trust rules. It should not be updated for ordinary local work.

## Default Rule

Local changes are recorded inside this repository first as implementation evidence, not as competing canon.

Use `docs/**` for:

- implementation notes;
- local backlog and release notes;
- SQL and migration records;
- runtime/API/test contracts derived from RAverse;
- temporary audits and comparisons;
- product-specific implementation evidence that is still being tested;
- evidence, screenshots, references, and operational findings.

Update the shared canon store only when a local decision becomes durable enough to govern future work across the project. Until then, `docs/**` remains derived / implementation-only.

The repo runtime manifest layer serializes RAverse into execution artifacts. These files are not equal sources of semantic truth:

- `data/design-tokens/cw.tokens.json`
- `data/generator/screen_manifests.json`
- `data/generator/archetype_contracts_v0_1.json`
- `data/generator/route_family_contracts.json`

## Agent Output Format

For ordinary agent-facing output inside this repository, file references should use repo-relative paths with line numbers.

Preferred form:

- `src/components/platform/PlatformBlocks.module.css:167`

Avoid full absolute filesystem paths in normal handoff notes, progress updates, and review comments unless the user explicitly asks for them.

`docs/legacy/**` is a read-only legacy reservoir. It exists for provenance, audits, and reference recovery, not as active guidance for new work.

## When To Update RAverse

Update `/Users/G/Documents/RAverse/ReOS/Projects/CenterWay` only when all conditions are true:

- The decision changes a stable product, brand, интерфейс, architecture, data, or release invariant.
- The decision should guide more than one immediate task or implementation file.
- The local repo already contains enough evidence to explain why the change is needed.
- The change resolves drift, removes ambiguity, or promotes a repeated local pattern into a rule.
- The update can be written as a compact canon change, not as a raw work log.

## When Not To Update RAverse

Do not update the shared canon store for:

- one-off fixes;
- temporary implementation details;
- exploratory notes;
- unresolved alternatives;
- task-local tradeoffs;
- routine bug reports;
- local screenshots or generated artifacts;
- changes that only affect one route, component, script, or migration unless they revise a broader invariant.

Keep those inside `docs/**` until they stabilize.

## Promotion Flow

1. Record the local change in `docs/**`.
2. Link it to code, scripts, migrations, or tests where relevant.
3. Let the decision survive implementation or review.
4. Promote only the stable rule into RAverse.
5. Leave the detailed local evidence in this repository.

## Canon Compliance Rule

The important future check is not legacy coverage.

The important check is:

- the runtime manifests still serialize the active canon;
- materially changed behavior still matches the canon;
- when a notable product, brand, интерфейс, architecture, route-family, data, or release invariant changes, the canon is updated accordingly;
- every agent completes preflight before starting substantial work.
- after each push, the agent follows the remote CI/deploy loop for the exact pushed `headSha` instead of stopping at local green checks.

If implementation changes are large enough to alter user-facing structure, semantic roles, token contracts, block contracts, CTA logic, route-family logic, route boundaries, admin rules, data contracts, or release gate, treat that as a canon-sync event.

Canon-sync means:

1. update the local operational doc;
2. decide whether the change is durable enough for RAverse;
3. if yes, update the smallest relevant RAverse canon note in the same work cycle.

## Remote CI Loop

For review-branch and PR work, local green checks are necessary but not sufficient.

The default operating rule is:

1. push the coherent change set;
2. inspect fresh remote runs for that exact `headSha`;
3. inspect failed logs directly if any run is red;
4. inspect failed preview deployments directly if deploy is red;
5. treat screenshots as secondary evidence, not as the main source of CI status;
6. continue the fix -> validate -> push -> inspect loop until the active remote run set is green or an external blocker is isolated.

## Conflict Rule

If `docs/**` and RAverse disagree, treat RAverse as the current canon and `docs/**` as local evidence.

If the local evidence proves the canon is outdated, update the local doc first, then promote the smallest necessary canon change to RAverse.

## Required Preflight

Before each new work cycle, agents must read:

- `docs/CANON.md`
- `/Users/G/Documents/RAverse/ReOS/Projects/CenterWay/ABOUT.md`
- `/Users/G/Documents/RAverse/ReOS/Projects/CenterWay/CenterWay.md`
- `/Users/G/Documents/RAverse/ReOS/Projects/CenterWay/Реестр.md`

Then they must read the domain canon relevant to the task.

For public UI, platform pages, product funnels, tokens, or visual system work, they must also read:

- `docs/platform_agent_preflight.md`

Agents should not read or edit `docs/legacy/**` by default. Use it only when:

- provenance needs to be checked;
- an old decision must be traced;
- a script or audit explicitly needs a legacy reference.

## Local-Only Docs

These local documents are intentionally not part of the shared canon:

- `docs/CANON.md`
- `docs/landing-short-irem-product-palettes.md`
- `docs/landing-short-irem-size-policy.md`
- `docs/platform_agent_preflight.md`

They remain local unless their contents become durable cross-project canon.
