# Dependency security — 2026-10-21

The first fix commit was pushed after PR #353 had already merged. GitHub checks
the default branch for alert #9, so the branch-only commit could not close it.
This follow-up carries the dependency fix from current `main`.

The alert has no patched `sprintf-js` release. A scoped npm override pins only
Mammoth's `argparse` to 2.0.1; the regenerated lockfile then resolves
`mammoth → argparse` to that safe copy and removes `sprintf-js`. Mammoth remains
at 1.12.3. Keep the scoped override until Mammoth changes its CLI dependency.

The prior working-tree verification checked the Mammoth CLI against argparse
2.0.1 by converting a generated DOCX to HTML and Markdown. Verify the locked
installation in this branch as part of the security change.

Sources:

- [sprintf-js advisory](https://github.com/advisories/GHSA-hp3w-g68c-fv3c)
- [argparse v2 to v3 compatibility notes](https://github.com/nodeca/argparse/blob/master/doc/migrate_v2_to_v3.md)
