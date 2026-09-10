# 0003 — Four kinds of test, and component tests are absent on purpose

2026-09-11. Status: accepted.

## Context

140 `.tsx` files and no `.test.tsx`; no jsdom, no Testing Library. The
existing "contract" tests grep sources. The routes money passes through —
the payment webhook, the SendPulse webhook, order creation — had no test at
all until this day, while the pure helpers around them were well covered.
The question was whether to add a rendering harness or to say plainly what
the tests are.

## Decision

Four kinds, named in AGENTS.md: unit tests next to the code, running server
modules against the in-memory `FakeSupabase`; route tests, which are unit
tests that call a handler's `POST`/`GET` with a `NextRequest` and mocked
collaborators; contract tests that prove a text invariant; and browser
smoke with Playwright, one spec needing no secrets and starting `next start`
itself. Component tests: none. The components are thin over server data and
CSS modules, and what goes wrong in them is visual, which the browser smoke
and the design gates catch. `vitest` collects `.test.tsx` anyway, so the day
a component earns a test nothing stands in the way — but nobody adds a
rendering harness to test one component.

Coverage is a ratchet: the thresholds in `vitest.config.ts` are the day's
baseline rounded down, CI fails below them, a change that raises them moves
them up, and nobody chases the number.

## Consequences

Every route that writes to the database gets a route test; the fake learns
a query chain rather than a test loosening an assertion. Visual regressions
are caught late (in a browser, not in a unit run) — accepted, because the
alternative was a harness that tests React more than it tests CenterWay.
