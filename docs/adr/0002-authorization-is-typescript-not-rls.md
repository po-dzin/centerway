# 0002 — Authorization is the TypeScript, not Row Level Security

2026-09-10. Status: accepted.

## Context

The schema carries 74 policies on 40 tables, and the application never meets
them: every server read and write goes through the service role, which
bypasses RLS, and roles are re-checked in JavaScript. The policies looked
like a guard and guarded nothing on the server path. Two honest options:
move the server onto a cookie-bound client and rely on RLS, or state that
the JavaScript is the gate.

## Decision

The JavaScript is the gate. `requireAdmin`, `verifyBearer` and the
entitlement check in `src/lib/auth/` and `src/lib/admin/access.ts` are the
authorization; a route that needs a check writes it in TypeScript. The
policies stay as defence in depth for anything that reaches the database
with a user token — the browser client, a future native app — and no server
code relies on one.

## Consequences

One place to read when asking "who may do this", and no policy to keep in
step with the code. The cost is that the server has no second net: a route
that forgets its check is open, which is what the route tests and the
`withRoute` wrapper exist to make visible. Reopen this if a client ever
talks to the database directly with a user token on a path that matters.
