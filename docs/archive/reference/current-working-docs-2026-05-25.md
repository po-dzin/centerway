# Current Working Docs Set

Date: 2026-05-25
Status: active local index

## Purpose

This file is the short working-set index for the current CenterWay repo state. It does not replace the deeper docs; it identifies which files should be treated as the default operational layer for ongoing platform work.

## Current Working Files

- `docs/CANON.md` — local docs-vs-RAverse policy and repo-level canon workflow
- `docs/platform_agent_preflight.md` — mandatory preflight for public UI and platform work
- `docs/platform-runtime-boundary-2026-05-24.md` — current ownership split between typed platform routes and generator routes
- `docs/platform-unification-wave-1-2026-05-24.md` — implemented unification baseline and verification set
- `docs/platform-route-nav-contract-2026-05-18.md` — stable platform route set plus active topbar-nav marker contract
- `docs/platform-program-product-template-architecture-2026-05-13.md` — shared platform template architecture
- `docs/design-system-spec-2026-05-17.md` — DS/token contract reference for platform work
- `docs/ci-followthrough-protocol-2026-05-25.md` — required post-push GitHub/Vercel validation loop
- `docs/sales-reports-bot.md` — local analytics reporting contract, including the top-3 campaigns rule

## Working Rule

- Use the files above as the default repo-level operational layer.
- Use other `docs/*.md` files only when the task explicitly touches that area or when provenance is needed.
- Keep backup-only and exploratory docs out of the default work cycle unless they are promoted back into the active working set.

## Current Repo State Summary

- public platform routes are owned by typed platform templates;
- generated funnel entry is isolated to `/funnel-entry/consult`, `/funnel-entry/detox`, and `/funnel-entry/herbs`;
- public aliases collapse into platform IA instead of exposing generator ownership on the main domain;
- topbar active navigation is a text-led route marker, not a filled control;
- post-push CI/deploy follow-through is part of the implementation loop, not an optional support step.
