# Funnel Runtime Separation — 2026-05-14

Local operational note for separating public funnel routes from the platform root shell.

## Scope

- surface: product funnel
- semantic role: offer + trust + proof
- user question: "what is this product, can I trust it, and what should I do next?"
- token source: landing token bridge + route-owned landing assets
- content source: existing landing runtime and landing-static payloads
- route boundary: separate funnel routes, not platform routes

## Runtime Rule

`short`, `reboot`, and `irem` must render under a dedicated App Router root layout that does not import `src/app/globals.css` and does not inherit the platform shell.

The platform and funnel surfaces stay in one repository, but they do not share the same visual root runtime.

## What stays shared

- `src/lib/landing/**`
- landing manifests/content/runtime contracts
- shared landing token bridge assets under `src/landing-static/shared/**`
- checkout and tracking endpoints
- semantic DS gates and route-family rules

## What becomes isolated

- root layout
- global platform CSS baseline
- platform font shell
- any platform-first body class or page chrome assumptions

## Reason

The previous `preload -> stylesheet` landing shell still painted through the platform root shell first, which created a visible style jump on `short` and `irem`. Route separation is required to remove that dependency without discarding landing DS gates.
