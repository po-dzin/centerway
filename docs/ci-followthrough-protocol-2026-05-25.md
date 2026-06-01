# CI Follow-Through Protocol

## Purpose

This protocol makes post-push validation explicit for CenterWay review branches and PR branches.

The rule is simple: local green checks do not finish the work cycle by themselves. After every push, the agent continues until the remote run set for the same `headSha` is green or the next blocker is isolated and fixed.

## Trigger

Apply this protocol whenever work is pushed to a review branch, PR branch, or any branch that is expected to pass GitHub checks and preview deployment.

## Required Loop

1. Push the coherent change set.
2. Resolve the exact pushed `headSha`.
3. Inspect fresh GitHub Actions runs for that `headSha`.
4. If `push` or `pull_request` checks fail, fetch `log-failed` directly.
5. If preview deployment fails, inspect the deployment directly.
6. Fix the blocker locally.
7. Rerun the smallest relevant local validation set.
8. Push the next fix.
9. Repeat until the active run set for the latest `headSha` is green or an external blocker is clearly isolated.

## Default Commands

Primary GitHub checks:

- `gh run list --branch <branch> --limit <n> --json databaseId,headSha,status,conclusion,event,workflowName,displayTitle`
- `gh run view <run-id> --log-failed`

Preview deployment checks:

- `npx vercel inspect <deployment-id>`

Local verification before the next push should stay scoped to the blocker, but usually includes:

- `npm run build`
- `npm run lint`
- directly relevant smoke or contract checks

## Operating Rule

- Do not wait for the user to provide screenshots if remote status can be inspected directly.
- Use screenshots only as supplemental evidence when they help locate the failed run faster.
- Always reason from the latest pushed `headSha`, not from older failed runs.
- If repeated failures come from stale, uncommitted local fixes, commit and push those fixes instead of re-diagnosing the same class of error.

## Current CenterWay Context

This protocol is especially important here because the platform unification work has repeatedly surfaced hidden drift between:

- local working tree fixes;
- the actually pushed PR branch state;
- GitHub Actions build/typecheck state;
- preview deployment state.

The practical consequence is that post-push follow-through is part of the implementation cycle, not a separate support step.
