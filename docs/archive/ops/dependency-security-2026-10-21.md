# Dependency security — 2026-10-21

Scope: Dependabot #9 and #11–13 from the supplied screenshot. No UI, route,
schema, or durable canon contract changes.

- GitHub already reports #11–13 as `fixed` (2026-10-21). This working branch
  still had Vite 8.3.0, so its lockfile is updated to 8.3.5, including required
  Rolldown/PostCSS dependencies. Vite embeds the affected editor integration;
  absence of a separate `launch-editor` package alone does not prove safety.
- #9 has no patched `sprintf-js` release. A scoped npm override sets only
  Mammoth's `argparse` to 2.0.1, removing `argparse` 1.0.10 and `sprintf-js`
  from the tree. Mammoth stays at 1.12.3. Even Mammoth 1.13.0 still declares
  `argparse ~1.0.3`, so updating Mammoth alone would not resolve this alert.
- Keep the override at 2.0.1: it retains Mammoth CLI's v1 compatibility API;
  argparse v3 removes that API. Revisit when Mammoth updates its CLI/dependency.
- Application DOCX import is covered by `src/lib/lms/lessonDocuments.test.ts`.
  Manual CLI verification converts a generated DOCX to both HTML and Markdown;
  both preserve its text. Deprecated CLI aliases emit warnings but still work.

Validation: lint (one existing navigation warning), typecheck, all 232 test files /
2376 tests pass. Production build passes (110 static pages generated).
`npm ls` resolves Mammoth to overridden argparse 2.0.1 and Vitest to Vite 8.3.5.
The final npm audit contains none of these four advisories. Audit is not globally
clean: a separate braces advisory propagates through micromatch / fast-glob /
eslint-config-next (five reported packages, outside the supplied four alerts).

Remote status: #9 remains open until the dependency fix reaches the default
branch and GitHub rescans it. No alert was manually dismissed; no push or
deployment is part of this local cycle.

Sources:

- [sprintf-js advisory](https://github.com/advisories/GHSA-hp3w-g68c-fv3c)
- [Windows path advisory](https://github.com/vitejs/launch-editor/security/advisories/GHSA-587h-7wmj-h5pm)
- [Windows escaping advisory](https://github.com/vitejs/launch-editor/security/advisories/GHSA-698v-4r3x-3vcv)
- [Editor flag advisory](https://github.com/vitejs/launch-editor/security/advisories/GHSA-r825-w8mm-5pxw)
- [argparse compatibility migration](https://github.com/nodeca/argparse/blob/master/doc/migrate_v2_to_v3.md)
