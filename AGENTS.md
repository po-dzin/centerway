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

For every changed interactive control, also declare its `selection_family` as
`contour`, `ink`, or `hybrid` according to `docs/design-system.md` →
“Selection grammar: contour, ink, hybrid”. This is mandatory in the preflight
and review notes. Reuse `InteractionInkLabel` / `InteractionInkIcon` for any
ink state; never draw, transform, resize or animate an ink stroke locally. The
account-menu `InteractionInkLabel variant="menu"` is the canonical selected
text gesture, including selected labels inside compound controls.

UI controls must not expose native text selection. Use the global no-selection
contract for controls and preserve selectable reading/editable content; never
apply `user-select: none` to an entire page or learning document.

Before changing surface boundaries, also read `docs/design-system.md` →
"Boundary hierarchy across the three layers". Declare the boundary role:
none (collection/status/loading), structural (panel/chrome), quiet (labelled
command/search/overlay), or essential (checkbox/radio). Never use the strong
checkbox stroke as a universal decorative outline. Media-menu paint follows
the optical hover-circle token; its touch target must not shrink with it.

Transient action results use the shared `ToastProvider` / `useToast` contract
in `docs/design-system.md` → "Transient notifications: one application viewport".
Do not insert success/error banners into shelf/editor layout or mount nested
providers. Platform, library, Builder and admin share this mechanism; funnels
are outside its scope. Field validation and critical recovery remain contextual.

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

## Database Rule

The schema record is `supabase/migrations/`, and the journal of what
production has is `supabase_migrations.schema_migrations`. They agree since
2026-09-10 and must keep agreeing: a change goes in as a file there and is
applied with `npm run db:push` (through the session pooler — the direct host is
IPv6-only from this machine), or with `psql` followed by a journal row written
by hand. Never as a statement typed into the SQL editor and nowhere else; that
is how 47 migrations went unregistered. `docs/migration/README.md` has the
procedure and the two unapplied files awaiting a decision.

Regenerate `src/lib/db/database.types.ts` (`npm run db:types`, needs Docker)
in the same change as the migration, and commit it with it.

**Row Level Security is not the application's guard.** Decided 2026-09-10: the
server reads and writes through the service role, which bypasses RLS, and
authorization is the JavaScript in `src/lib/auth/` and `src/lib/admin/access.ts`
— `requireAdmin`, `verifyBearer`, the entitlement check. The policies in the
schema stay as defence in depth for anything that reaches the database with a
user token (the browser client, a future native app), and no policy is to be
relied on by server code. A route that needs a check writes it in TypeScript.

## Test Rule

Four kinds of test exist, and a fifth deliberately does not.

- **Unit tests** (`npm run test:unit`, vitest, `src/**/*.test.{ts,tsx}`) next
  to the code they cover. Server modules run against `src/lib/admin/fakeSupabase.ts`,
  an in-memory client that answers the query chains the code uses; a chain it
  does not know throws, and the fix is to teach the fake, not to loosen the test.
- **Route tests** are unit tests that call a handler's `POST`/`GET` with a
  `NextRequest` and mocked collaborators (`src/app/api/wfp/webhook/route.test.ts`
  is the pattern). The routes money passes through have them; a new route that
  writes to the database gets one.
- **Contract tests** grep sources for a rule that must hold (`*.contract.test.ts`
  and the `guard:*` scripts). They prove a text invariant, not behaviour.
- **Browser smoke** (Playwright, `tests/e2e`). `smoke:thanks:browser` needs no
  secrets — `playwright.config.ts` starts `next start` on the build — and runs
  on every CI job. `smoke:platform:browser` needs a deployment with a database
  and runs only when `SMOKE_UI_BASE_URL` is set.
- **Component tests: none, on purpose.** There is no jsdom and no Testing
  Library. The components are thin over server data and CSS modules, and what
  goes wrong in them is visual, which the browser smoke and the design gates
  catch. `vitest` collects `.test.tsx` all the same, so the day a component
  earns a test, nothing stands in the way. Do not add a rendering harness to
  test a single component; write the browser smoke instead.

Coverage is a ratchet (`npm run test:coverage`, thresholds in `vitest.config.ts`):
the figures are the day's baseline rounded down, CI fails below them, and a
change that raises them moves them up. Nobody chases the number.

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
- `docs/LOCAL_DOCS.md`
- `docs/platform_agent_preflight.md`

Keep them local unless their rules become stable cross-project canon.
