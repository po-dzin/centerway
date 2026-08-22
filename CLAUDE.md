# CLAUDE.md

Guidance for Claude Code working in this repository.

## Start here

`AGENTS.md` is the working contract for this repo and applies to Claude sessions
exactly as it does to any other agent: the Mandatory Canon Preflight before any
public page, block, component, route, CTA, or visual token; the Canon Start
Protocol at the top of a work cycle; the safe-push and CI follow-through rules
before and after publishing anything.

`docs/platform_agent_preflight.md` is the operational form of that preflight —
the semantic role, user question, token source, content source, and route
boundary you must be able to state before editing.

Shared canon lives outside this repository, under the paths listed in
`AGENTS.md`. When local docs and that canon disagree, the canon is active
authority unless local evidence shows it is out of date.

## Validation

`npm run ds:qa` is the design-system gate: canon:guard, tokens:check,
ds:sync:check, brand:check, guard:ds-contract, guard:contrast, guard:buttons,
generator:validate, semantic:audit, lint, build. Run it before pushing anything
that touches tokens, the mark, buttons, or generated screens.

Tokens are edited in `data/design-tokens/cw.tokens.json` and built with
`npm run tokens:build`. The marker blocks in `src/app/globals.css` are codegen
output — never hand-edit them.

## Design contract

This project carries the shared design meta-contract `ds-drift/1`. Read
`docs/design-system/DESIGN_CONTRACT.md` before touching design tokens, the
design brief, or the Claude Design mirror.

Three roles, and only three: **code** (what ships to a browser), **mirror** (what
the Claude Design project holds), **brief** (what the design document claims the
system is). `design.drift.json` at the repo root names their files and declares
which pairs are gated.

- `npm run ds:drift` — read-only probe; reports where the three disagree and syncs nothing.
- `npm run ds:drift:report` — the same, written to the report directory as a dated record.
- `npm run ds:drift:gate` — the CI form; exits non-zero when a gated pair drifts.

Discovery and closure are separate passes. Never export, regenerate a bundle, or
push to the Claude Design project in the same pass that discovered the drift —
a probe that also fixes cannot be trusted to report honestly what it found.
