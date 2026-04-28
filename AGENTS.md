# CenterWay Agent Contract

## Mandatory Canon Preflight For UI Work

Before editing any public page, page block, component, route, form, CTA, card, navigation, layout, or visual token, every agent and sub-agent must complete this preflight.

Read the shared canon:

1. `/Users/G/Documents/RAverse/ReOS/Projects/CenterWay/CenterWay.md`
2. `/Users/G/Documents/RAverse/ReOS/Projects/CenterWay/Бренд-контракт.md`
3. `/Users/G/Documents/RAverse/ReOS/Projects/CenterWay/Дизайн-токены.md`
4. `/Users/G/Documents/RAverse/ReOS/Projects/CenterWay/Семиотический паспорт.md`
5. `/Users/G/Documents/RAverse/ReOS/Projects/CenterWay/UI-UX канон.md`
6. `/Users/G/Documents/RAverse/ReOS/Projects/CenterWay/Блоки и компоненты.md`
7. `/Users/G/Documents/RAverse/ReOS/Projects/CenterWay/Архитектура.md`
8. `/Users/G/Documents/RAverse/ReOS/Projects/CenterWay/Лендинги.md`
9. `/Users/G/Documents/RAverse/ReOS/Projects/CenterWay/Registry.md`

Also read the local implementation references listed in `docs/platform_agent_preflight.md`.

Before editing, state the semantic role, user question, token source, content source, and route boundary for every new or materially changed page/block/component. If any of these are unclear, resolve the semantic contract before coding.

Do not define new local palettes, shadows, radii, type scales, or glass effects inside component CSS modules as an ad hoc decision. Use the canon and app/global DS tokens first.

When delegating to a sub-agent, include this exact instruction:

`Before editing, read AGENTS.md and complete the CenterWay Mandatory Canon Preflight. Return the semantic role, user question, and token source for every page/block/component you changed.`

## Canon Start Protocol

Before each new work cycle in this repository, read the current canon entry points:

1. `docs/CANON.md`
2. `/Users/G/Documents/RAverse/ReOS/Projects/CenterWay/ABOUT.md`
3. `/Users/G/Documents/RAverse/ReOS/Projects/CenterWay/CenterWay.md`
4. `/Users/G/Documents/RAverse/ReOS/Projects/CenterWay/Registry.md`

Then read the specific RAverse canon note for the current task domain:

- architecture: `/Users/G/Documents/RAverse/ReOS/Projects/CenterWay/Архитектура.md`
- brand or claims: `/Users/G/Documents/RAverse/ReOS/Projects/CenterWay/Бренд-контракт.md`
- UI/UX: `/Users/G/Documents/RAverse/ReOS/Projects/CenterWay/UI-UX канон.md`
- design tokens: `/Users/G/Documents/RAverse/ReOS/Projects/CenterWay/Дизайн-токены.md`
- generator or screen assembly: `/Users/G/Documents/RAverse/ReOS/Projects/CenterWay/Генератор экранов.md`
- semantic blocks or components: `/Users/G/Documents/RAverse/ReOS/Projects/CenterWay/Блоки и компоненты.md`
- landings: `/Users/G/Documents/RAverse/ReOS/Projects/CenterWay/Лендинги.md`
- dosha test: `/Users/G/Documents/RAverse/ReOS/Projects/CenterWay/Dosha-тест.md`
- admin: `/Users/G/Documents/RAverse/ReOS/Projects/CenterWay/Админка.md`
- release gates: `/Users/G/Documents/RAverse/ReOS/Projects/CenterWay/Ship-чеклист.md`
- migration or SQL: `/Users/G/Documents/RAverse/ReOS/Projects/CenterWay/Миграция и SQL.md`
- canon governance or drift checks: `/Users/G/Documents/RAverse/ReOS/Projects/CenterWay/Мета-аудит.md`

For public UI, platform pages, product funnels, or visual system work, also read:

- `docs/platform_agent_preflight.md`

Do not read or edit `docs/legacy/**` by default. Use it only for provenance, recovery of an old decision, or an explicitly legacy-aware audit/script.

## Local Documentation Rule

Record ordinary local work in `docs/**` first.

Use local docs for implementation notes, audits, route-specific decisions, runtime contracts, SQL records, test notes, and unresolved alternatives.

Update RAverse only when a local decision becomes a durable project rule that should guide future work beyond one immediate task, route, script, component, or migration.

## Conflict Rule

If local docs and RAverse disagree, treat RAverse as the active canon.

If local evidence shows the canon is outdated, update the local doc first, then promote the smallest necessary canon change to RAverse.

## Canon Sync Trigger

If a work cycle materially changes any of the following, do not stop at code-only completion:

- user-facing structure or semantic block composition;
- CTA hierarchy or route logic;
- token contracts, visual roles, or component semantics;
- brand claims, policy boundaries, or trust surfaces;
- admin rules, data contracts, migration rules, or release gates.

In those cases:

1. update the local operational doc in `docs/**`;
2. decide whether the change is durable cross-project behavior;
3. if yes, update the smallest relevant RAverse canon note in the same work cycle.

## Local-Only Docs

These documents are intentionally local and are not part of the shared canon:

- `docs/CANON.md`
- `docs/landing-short-irem-product-palettes.md`
- `docs/landing-short-irem-size-policy.md`
- `docs/platform_agent_preflight.md`

Keep them local unless their rules become stable cross-project canon.
