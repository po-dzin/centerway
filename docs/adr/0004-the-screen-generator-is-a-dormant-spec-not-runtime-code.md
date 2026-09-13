# 0004 — The screen generator is a dormant spec, not runtime code

2026-09-11. Status: accepted.

## Context

`src/lib/generator/**` was written for a runtime that renders whole screens
from manifests, and `data/generator/*.json` still describes it: token packs,
block manifests, screen manifests, archetype contracts. The runtime never
shipped. Every product surface is either a static landing or a hand-written
React page, and `token_packs.json` says so in its own `_status` field —
"DORMANT — reserved for the generated-app runtime. No product is
funnelRuntime:'generated-app' today."

The TypeScript side had rotted into something worse than unused. Its single
remaining thread to production ran through `resolveExperimentAssignmentRoute()`,
a function whose entire body was `return null`. Both of its call sites — in
`proxy.ts` and `lib/proxy/landing.ts` — were guarded by that return, so no
experiment was ever assigned and no `cw_theme` cookie was ever written. Behind
that dead branch, `registry.ts` still pulled all ten manifest files (172 KB of
JSON) statically into the proxy bundle. `canon.ts` and `validators.ts` — 988
lines — duplicated rules that `scripts/lib/generator-manifests.mjs` already
enforces in its own JavaScript copy, which is what `generator:validate`
actually runs. `resolve.ts` and `themeCatalog.ts` had no importers at all.

## Decision

The data and its gates stay; the TypeScript runtime goes. `data/generator/**`
remains under `generator:validate`, `generator:snapshot` and
`generator:determinism`, which read it through `scripts/lib/` and never through
`src/`. `src/lib/generator/` is deleted outright, and with it the experiment
contour it kept alive: `lib/experiments/engine.ts` and `lib/proxy/experiments.ts`.

A spec held honest by a gate costs a few seconds of CI. Sixteen hundred lines
of runtime kept warm for it cost every reader who has to decide whether the
module they are looking at is live.

## Consequences

The proxy no longer imports manifests it cannot use. Nothing renders
differently: the deleted branch could not execute.

A/B testing on real traffic is wanted — which of two first screens converts,
two CTAs or three — and this deletes the machinery for it. That is deliberate.
The manifests survive, the assignment engine was 210 lines, and rebuilding it
against the platform's actual surfaces will be cheaper and more honest than
adapting a design drawn for a generator that never ran. When that work starts,
this decision is superseded, not reversed.

The same pass removed four components and modules with no importers:
`RouteAuthGate`, `AdminTabPanel`, `BuilderBlockPreview`, `lib/auth/protectedRoutes`.

`src/lib/agent/**` was reviewed in the same pass and deliberately kept. It is
not the same case: `questions/store` is live in the Telegram support bot,
`knowledge/` is covered by the `agent-eval` gate, and `runs.ts` / `budget.ts`
are the accounting a model call has to land inside — written first on purpose,
with their tables already in production. See `docs/agent-contour-2026-08-21.md`.
