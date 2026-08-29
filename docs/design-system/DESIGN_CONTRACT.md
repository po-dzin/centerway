# Design meta-contract · `ds-drift/1`

This file is identical in every project that carries the contract. Everything
project-specific lives in `design.drift.json` at the repo root — this document
describes only the mechanism, so that the mechanism reads the same everywhere.

## The three roles

Every project names three surfaces, and only three:

| role | what it is | authority |
|---|---|---|
| **code** | what actually ships to a browser | the only thing a user ever sees |
| **mirror** | what the Claude Design project holds | derived; never a source |
| **brief** | what the design document claims the system is | intent; wins over code only until code is corrected |

A design system is healthy when the three agree. Every real failure in this area
is one of them having moved without the others — so the contract's whole job is
to make that movement visible on demand, cheaply, and without side effects.

## The two passes are separate, always

**Discovery** — `ds:drift`. Reads all three roles, reports where they disagree,
writes a dated report, and changes nothing. It never exports, never regenerates
a bundle, never touches the Claude Design project.

**Closure** — the project's own export and sync commands, named in
`design.drift.json`. Run deliberately, as its own change, after a human has read
the drift report and decided which side is right.

These never run in the same pass. A probe that also fixes cannot be trusted to
report honestly what it found: the fix decides the finding. This is the one rule
in the contract that is not negotiable per project.

## What counts as drift

The probe distinguishes four findings, because they carry different weight:

- **Conflict** — both sides declare the same token and disagree on its value.
  Almost always real. Someone changed one side only.
- **One-sided** — one side declares a value the other never does. Usually a
  scope the other side flattens away or does not model at all. Read it before
  calling it drift; a recurring one-sided finding is usually a modelling gap,
  not a mistake.
- **Only in A / only in B** — a token exists on one side. In the `mirror -> code`
  direction, *only in code* means the mirror is behind; *only in mirror* means
  the code retired something the mirror still shows.
- **Brief colour with no token** — a hex the design document commits to that no
  shipped token carries. Either prose describing a retired value, or the design
  moved and the code did not.

## Gating

Each pair declares `gate: true|false` and optionally `gateOn: "conflict"`.

A pair is gated only when both sides are machine-derived from one source — then
any difference is a genuine break and belongs in CI. A pair where one side is
hand-authored stays on watch: gating it would train everyone to ignore a red
check. Moving a pair from watch to gated is the milestone that says the export
became machine-owned.

## Commands

```
npm run ds:drift          # print the report; exit 0 always; nothing is written
npm run ds:drift:report   # the same, and write it to the config's reportDir
npm run ds:drift:gate     # exit 1 if a gated pair drifts — the CI form
```

The report is dated and additive. Two reports a month apart are the honest
record of whether the gap is closing or widening, which no single snapshot can
show.

## Adding the contract to a project

1. Copy `scripts/design/ds-drift.mjs` verbatim. It is shared code; if it needs a
   change, change it in every project or the reports stop being comparable.
2. Write `design.drift.json`: name the three roles' files, then the pairs.
3. Add the three npm scripts above.
4. Add the pointer block to `CLAUDE.md`.
5. Run `ds:drift:report` once and commit the first report as the baseline.

## Source kinds available to `design.drift.json`

| kind | reads |
|---|---|
| `css` | custom properties from one file (`path`), a list (`paths`), or every `.css` in a directory (`dir`), keyed by selector so a theme override is never compared against the base |
| `token-json` | a layered token JSON — any nesting, `--name: value` leaves |
| `frontmatter-colors` | the `colors:` block of a design brief's YAML frontmatter |
| `doc-hexes` | every colour literal a prose document commits to |

Pair options: `mode` (`tokens` \| `values`), `only` / `ignore` (token-name
prefixes), `valuePattern` (a regex, `values` mode only), `gate`, `gateOn`,
`note`. The `note` is printed in the report — use it to record why a pair is
scoped the way it is, so the next reader does not re-derive it.
