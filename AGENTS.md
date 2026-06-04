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
9. `/Users/G/Documents/RAverse/ReOS/Projects/CenterWay/Реестр.md`

Also read the local implementation references listed in `docs/platform_agent_preflight.md`.

Before editing, state the semantic role, user question, token source, content source, and route boundary for every new or substantially changed page/block/component. If any of these are unclear, resolve the semantic contract before coding.

Do not define new local palettes, shadows, radii, type scales, or glass effects inside component CSS modules as an ad hoc decision. Use the canon and app/global DS tokens first.

When delegating to a sub-agent, include this exact instruction:

`Before editing, read AGENTS.md and complete the CenterWay Mandatory Canon Preflight. Return the semantic role, user question, and token source for every page/block/component you changed.`

## Canon Start Protocol

Before each new work cycle in this repository, read the current canon entry points:

1. `docs/CANON.md`
2. `/Users/G/Documents/RAverse/ReOS/Projects/CenterWay/ABOUT.md`
3. `/Users/G/Documents/RAverse/ReOS/Projects/CenterWay/CenterWay.md`
4. `/Users/G/Documents/RAverse/ReOS/Projects/CenterWay/Реестр.md`

Then read the specific RAverse canon note for the current task domain:

- architecture: `/Users/G/Documents/RAverse/ReOS/Projects/CenterWay/Архитектура.md`
- brand or claims: `/Users/G/Documents/RAverse/ReOS/Projects/CenterWay/Бренд-контракт.md`
- интерфейс: `/Users/G/Documents/RAverse/ReOS/Projects/CenterWay/UI-UX канон.md`
- design tokens: `/Users/G/Documents/RAverse/ReOS/Projects/CenterWay/Дизайн-токены.md`
- generator or screen assembly: `/Users/G/Documents/RAverse/ReOS/Projects/CenterWay/Генератор экранов.md`
- semantic blocks or components: `/Users/G/Documents/RAverse/ReOS/Projects/CenterWay/Блоки и компоненты.md`
- landings: `/Users/G/Documents/RAverse/ReOS/Projects/CenterWay/Лендинги.md`
- доша-тест: `/Users/G/Documents/RAverse/ReOS/Projects/CenterWay/Доша-тест.md`
- admin: `/Users/G/Documents/RAverse/ReOS/Projects/CenterWay/Админка.md`
- релизный гейт: `/Users/G/Documents/RAverse/ReOS/Projects/CenterWay/Релизный чеклист.md`
- миграция и SQL: `/Users/G/Documents/RAverse/ReOS/Projects/CenterWay/Миграция и SQL.md`
- canon governance or drift checks: `/Users/G/Documents/RAverse/ReOS/Projects/CenterWay/Мета-аудит.md`

Для публичного интерфейса, платформенных страниц, продуктовых воронок и задач по визуальной системе также читать:

- `docs/platform_agent_preflight.md`

Do not read or edit `docs/legacy/**` by default. Use it only for provenance, recovery of an old decision, or an explicitly legacy-aware audit/script.

## Local Documentation Rule

Record ordinary local work in `docs/**` first.

Use local docs for implementation notes, audits, route-specific decisions, runtime contracts, SQL records, test notes, and unresolved alternatives.

Update RAverse only when a local decision becomes a durable project rule that should guide future work beyond one immediate task, route, script, component, or migration.

## Agent Output Path Rule

When agents report changed files, references, handoff notes, or review comments, do not print full absolute filesystem paths by default.

Use only:

- repo-relative file paths like `src/components/platform/PlatformBlocks.module.css:167`
- or bare filenames with line when the reference is unambiguous

Do not use forms like `/Users/.../project/file.ts:42` in ordinary agent-facing output unless the user explicitly asks for the absolute path.

## Safe Push Rule

When the user asks to "push this block", "commit and push this part", or otherwise requests a scoped publish, treat that as a request for a safe, self-contained change set rather than a narrow file-only slice.

Before commit and push:

1. collect the full dependency set for that block, including imported modules, required config, scripts, migrations, docs, and runtime contracts it depends on;
2. verify the staged diff is internally coherent and does not leave unresolved imports, broken routes, partial schema changes, or missing assets/scripts;
3. run the relevant validation for the block before pushing:
   - at minimum `lint`;
   - also `build` for runtime/code-path changes unless a known unrelated blocker prevents it;
   - plus any directly relevant smoke/contract checks for the affected area;
4. do not publish a knowingly incomplete slice just because only part of the local work was explicitly mentioned.

If unrelated dirty work exists in the tree, isolate the requested block safely instead of pushing a partial set that breaks CI or runtime.

## CI Follow-Through Rule

After every push to a review branch or PR branch, do not stop at local green checks.

The agent must proactively monitor the remote CI and preview deployment for the exact pushed `headSha` until the current run set is green or until a new blocker is identified and fixed.

Required loop after push:

1. check the fresh GitHub Actions runs for the pushed `headSha`;
2. if a `push` or `pull_request` run fails, fetch the failed logs directly instead of waiting for user screenshots;
3. if the preview deployment fails, inspect the deployment directly;
4. fix the blocker locally, rerun the relevant local validations, and push the next fix;
5. repeat until the active run set for the latest `headSha` is green or until an external blocker is clearly identified.

Default tools for this loop:

- `gh run list`
- `gh run view --log-failed`
- `npx vercel inspect <deployment>`

Do not ask the user to bring screenshots of failing checks if the agent can inspect the current remote status directly.
Treat screenshots as supplemental evidence only, not as the primary CI feedback channel.

## Conflict Rule

If local docs and RAverse disagree, treat RAverse as the active canon.

If local evidence shows the canon is outdated, update the local doc first, then promote the smallest necessary canon change to RAverse.

## Canon Sync Trigger

Если рабочий цикл существенно меняет что-либо из следующего, не останавливайся на кодовых правках:

- пользовательскую структуру или состав смысловых блоков;
- иерархию CTA или логику маршрутов;
- токенные контракты, визуальные роли или семантику компонентов;
- брендовые заявления, границы политики или поверхности доверия;
- админские правила, контракты данных, правила миграции или релизный гейт.

В этих случаях:

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
