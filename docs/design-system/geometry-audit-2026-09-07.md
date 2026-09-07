# Geometry audit: radius, spacing, heights (2026-09-07)

> **Status: all six steps done the same day.** The law below is enforced by
> `npm run guard:geometry`, which runs inside `ds:qa`. What the audit found is
> kept in the past tense where it has been fixed, and the burn-down that
> remains is named in `data/design-tokens/geometry-baseline.json` — 23 radius
> mismatches, 66 off-scale spacing values, 26 literal font sizes — each one
> visible to `grep` rather than dissolved into a "we should tidy this up
> sometime". The counts in the body of this document are the ones the audit
> started from; the table below says where each landed.
>
> | | before | after |
> | --- | --- | --- |
> | radius vocabularies | 5 | 1 |
> | un-named radius values | 9 | 0 |
> | spacing: token references | 619 | 959 |
> | spacing: literals that had a token | 103 | 0 |
> | spacing: off-scale values | 279 | 66 |
> | type: token references | 101 | 260 |
> | type: literal sizes (distinct) | 181 (36) | 26 (15) |

A count, not an opinion. Every number below was read out of the CSS as it
stands on `feat/full-photo-crop`, and the two live measurements were taken in a
browser against the dev server. The counts are as they were when the pass
started — the point of it was to turn «I want 20 here» into a statement that
can be checked, and the Status note above says which of them no longer hold.

The question it was collected to answer: **is radius a function of the size of
the object, or of its role?** Today it is neither, consistently. It is a
function of which file drew the object.

## 1. There are five radius vocabularies, and four of them claim to be the scale

| Where | Steps (px) | Named |
| --- | --- | --- |
| Platform (`--cw-radius-*`) | 6 · 12 · 16 · 20 · 28 · 999 | `inset` `sm` `md` `lg` `xl` `pill` |
| Control Panel (Tailwind defaults, `tailwind.config.js` has `extend: {}`) | 6 · 8 · 12 · 16 · 24 · 9999 | `rounded-md` `lg` `xl` `2xl` `3xl` `full` |
| Landings A (`--r-*`) | 11.2 · 16 · 22.4 · 999 | `--r-sm` `--r-md` `--r-lg` `--r-pill` |
| Landings B (`--landing-radius-scale-*`) | 10 · 12 · 24 · pill | `xs` `sm` `xl` `pill` |
| One-offs in platform CSS | 2 · 7.2 · 12.8 (plus 12 · 16 · 999 retyped) | — |

The Control Panel is the sharpest case: it runs Tailwind's untouched defaults,
so **`lg` means 20px in the platform and 8px in the panel** — the same word,
two and a half times apart, on surfaces a person moves between in one click.
83 declarations sit on that second scale (`rounded-lg` 26, `rounded-2xl` 25,
`rounded-xl` 23, `rounded-md` 7, `rounded-3xl` 2).

## 2. At one box size, the product gives four answers

Every rule below draws a box between 33 and 56px — the touch-target band, i.e.
"a control" — and sets its own radius:

| Radius | Object | File |
| --- | --- | --- |
| pill | `.nav a` — the topbar's nav link | `PlatformShell.module.css` |
| pill | `.diagnosticStepChip` (as a literal `999px`) | `PlatformComponents.module.css` |
| `lg` 20 | `.saveBar`, `.pagerLink` | `Builder`, `Lms` |
| `md` 16 | `.cw-btn`, `.control .option`, `.factGrid li`, `.timelineMore summary` | globals, theme control, author page |
| `sm` 12 | `.profileMenu button`, `.menuFold summary`, `.drawerItem`, `.navLayer .nav a`, `.dayBadge`, `.proofNoteIcon`, `.action` | five files |

`sm` is the most common answer for a 48px control (8 rules), `md` the second
(5), `pill` the third (5), `lg` the fourth (2) — and `--cw-radius-md` is
simultaneously the most-used token in the product overall (57 declarations).
So the *stated* control step and the *actual* control step are different
numbers.

## 3. Two decisions in `docs/design-system.md` never reached the screen

**The bar's nav links.** «Soft rect, not circles» (2026-09-06) lists them in the
sweep to `--cw-radius-md`. The sweep did edit them — `PlatformShell.module.css`
line 434 sets `--cw-radius-btn`. Thirty lines later a **second `.nav a` rule**
in the same file sets `--cw-radius-pill`, same specificity, later in source
order. Measured in the browser at 1280px: `border-radius: 999px`. The decision
was recorded, the code was edited, and nothing changed.

**Portraits.** The same entry claims every portrait takes `lg` (and the crop
preview `xl`). The code says otherwise, in three different ways:

- `AuthorPortrait.module.css` — `--portrait-radius: var(--cw-radius-pill)` at all three steps, and `authorPortraitContract.test.ts` **enforces** it: «A FACE IS ROUND, and the shape is not a caller's choice».
- `CabinetHero.module.css` `.avatar` — `pill`.
- `PlatformShell.module.css` `.profileAvatar` — `md` 16 (the bar).
- `[data-cw-chrome="organs"] .profileAvatar` — `50%` (the islands, added today).

A test enforces the opposite of what the doc asserts, and neither of them
describes all four call sites. This is the clearest evidence that the missing
rule is not *which number* but **who decides** — the object, or the box it sits
in.

## 4. Spacing: the scale is real, and a third of the values ignore it

Platform CSS (`src/app` + `src/components`, landings excluded), counting
`padding` / `margin` / `gap` declarations:

- **619** reference a token (`--cw-space-*`)
- **103** are literals whose exact value already has a token (`1rem` ×44, `0.5rem` ×24, `0.75rem` ×20, `0.25rem` ×10 …) — the scale, retyped
- **279** are literals with **no** step on the scale: `0.15` ×22, `0.55` ×18, `0.9` ×18, `0.35` ×17, `0.7` ×15, `0.4` ×14, `0.2` ×11, `0.85` ×11, `0.1` ×11, `0.6` ×10, `0.65` ×10, `0.3` ×9 …

So between `2xs` (0.25rem) and `md` (1rem) — four documented steps — the product
actually uses about **fourteen** distinct values. That is the "rhythm" problem
stated numerically: there is no rhythm below 1rem, there is a continuum.

Worst files: `PlatformResponsive` (60 off-scale), `PlatformShell` (41),
`Builder` (26), `PlatformBlocksOrientation` (24), `PlatformComponents` (22).

There is also a **second scale** holding the same numbers: `--ds-space-1…7`
(0.25 · 0.5 · 0.75 · 1 · 1.5 · 2 · 3) against `--cw-space-2xs…2xl`. The audit
first called it dead weight; that was wrong. `--ds-*` is the contract the five
static landings read — they cannot compose a CSS Module, so tokens are the only
way they can reference the platform's spacing at all — and `guard-ds-contract`
asserts it. Two names, two consumers, one set of numbers. What WAS drift is
platform CSS reaching for the landings' names: three declarations did, and now
none do.

## 5. Type has the same shape of problem

101 declarations read a `--ds-type-*` token. **49 distinct literal font sizes**
sit beside them — ten of them between `0.72rem` and `0.95rem`, which is a range
no reader can distinguish and no system can defend.

## 6. Heights are the one axis that is basically fine

55 declarations read `--ds-touch-target-min`, 3 read `--ds-button-min-height`,
and only **5** write `min-height: 3rem` by hand (`PlatformResponsive` ×3,
`PlatformShell` ×2). The rest of the literal heights are page-level measures
(`100svh`, `34rem`, `26rem`) which are content decisions, not control geometry.

Whatever the button contract did for heights, it worked. That is the model the
other two axes do not have.

---

## The law this proposes

**Radius is a function of the box, with exactly one carve-out for things that
are genuinely round.**

Role-based radius fails on contact with the product: «card» is 320px wide in the
shelf and 48px tall in a menu row, «control» is a 48px island and a 22rem
button. A role that appears at two sizes needs two radii, and then the role is
not deciding — the size is, quietly, through an exception. Better to say it
out loud:

| Box (the shorter side) | Radius | Reads as |
| --- | --- | --- |
| ≤ 24px | `inset` 6 | a detail inside something else |
| 25–56px | **`md` 16** | a control |
| 57–200px | `lg` 20 | a card, a tile, a sheet |
| > 200px | `xl` 28 | a surface, a screen, a plate |

`pill` only when the box is square **and** the object is genuinely round — a
dot, a rail, a track, a thumb, a handle. On the 54 pill/circle declarations in
the platform today, about 30 are exactly that and are correct.

Two carve-outs needed a decision rather than a default, and both were contested
in the repo. **Both were decided on 2026-09-07:**

1. **Text chips and badges** — **pill stays, as a named clause of the law.** A chip's radius is `height / 2` by construction, so it is not a step on any scale and cannot be expressed by the bands without ceasing to be a chip. ~11 declarations, no visual change; the guard exempts them by name.
2. **Portraits** — **a face is round wherever it appears.** The plate a face may sit in is a control and takes its box's step; the face inside it does not. `AuthorPortrait` and the cabinet's hero face were already round and stay; the bar's avatar moved back from `md` to `pill`; the islands' face keeps its round shape, now spelled with the token rather than `50%`. The doc's claim that «every portrait takes `lg`» was wrong and has been rewritten, and `authorPortraitContract.test.ts` now covers all four call sites rather than one — the drift was possible because the contract could only see the component it was written for.

Applied to the question that started this: the islands are a 48px box, so they
are `md` 16 — the current value — and **20 would be the card step on a
control**. 20 becomes right only if the table above is redrawn so that the
control band ends at 20, which then moves every button in the product.

## What makes it stick

None of this survives without enforcement, and the repo already proves it:
«Soft rect, not circles» was written down, applied, and silently undone by a
later rule in the same file. A guard is the difference between a decision and a
note.

`npm run guard:geometry` (new, alongside `guard:buttons`) would assert:

1. **No literal radius** where a token exists, and no radius value that is not a step (kills the 2px / 7.2px / 12.8px / 13px / 14px tail).
2. **Box ↔ radius** agreement for any rule that declares both a size and a radius — the check that would have caught `.nav a` on the day it was written.
3. **One vocabulary per surface**: the panel's `rounded-*` classes mapped onto `--cw-radius-*` through `tailwind.config.js` (`extend.borderRadius`), so `lg` cannot mean two things.
4. **No off-scale spacing** in new CSS — as a ratchet against the current count, not a big-bang failure: fail only when a file's off-scale count grows.

## Sequence

1. ~~`tailwind.config.js` — point `borderRadius` at the platform tokens.~~ **Done.** `rounded-md → sm 12`, `lg → md 16`, `xl → lg 20`, `2xl`/`3xl` → `xl 28`, `full → pill`, mapped by what each class is actually used on in the panel rather than by nearest number. The names stay Tailwind's; rewriting 83 call sites would have been a second change riding on this one. Verified in the browser: the panel now measures 16px where it measured 8.
2. ~~Settle the two carve-outs.~~ **Done** — see above. Chips keep `pill` as a named clause; a face is round everywhere, and the portrait contract now covers all four call sites.
3. ~~The `.nav a` duplicate and the nine literal radius declarations.~~ **Done.** The duplicate block is merged into one rule at `md` (the dead block also carried a `font-weight: 700` that had been losing to `680` for longer still; `680` is what was on screen, so `680` stayed). The three off-scale literals took the step their box asks for; the six retyped ones took the name of the value they already had, which is a rename with no visual change. Platform CSS now has no un-named radius: only tokens, `0`, and `50%`.
4. ~~`guard:geometry`.~~ **Done**, and wired into `ds:qa`. It enforces: radius is named; radius matches the box's band; the three carve-outs; one vocabulary in `tailwind.config.js`. Two ratchets, both baselined in `data/design-tokens/geometry-baseline.json` — 23 radius mismatches and the off-scale spacing count per file — so the build fails on the 24th, not on the 23 that are already there.
5. ~~Spacing.~~ **Done.** The three platform rules reaching for `--ds-space-*` are on `--cw-space-*`; the 101 literals that already had a token were renamed with no change in value; and 213 off-scale values were snapped to the 4px grid. The grid was a decision with data behind it: on the current scale only 49 of 260 values sat within 0.8px of a step, while a 2px grid below 16px would have fitted 171 — the product had been drawing on a finer grid than the scale offered. **The scale won anyway**, deliberately: a finer scale is a weaker scale, and the movement is at most 2px per value. What moves more than 2px was left alone (47 values, 15 distinct) — those are their own sizes and need eyes, not arithmetic.
6. ~~Type.~~ **Done, and the token moved rather than the product.** 143 of 181 literals sat within 1.6px of a token, which is not carelessness — it is people re-typing a token by eye. But the mass under `body-sm` sat at 0.85–0.92 while the token stood at 0.9375, above almost all of it: the drift was in the token. `--ds-type-body-sm-size` is 0.9rem now, and 155 literals took the name of the size they were already approximating. 26 are left, all of them display sizes with no step to land on.

Both are held by ratchets of their own in `guard:geometry`, on the same terms as the radius one: the build fails on the next new literal, not on the ones already counted.

### On the 23 mismatches the ratchet accepts

They are not all bugs, and that is the reason the check ratchets rather than
blocks. Most of them are **one principle the law does not yet state**: a row
inside a plated panel takes a step below its parent — the concentric-radius
rule, which this codebase already discovered locally and writes as
`calc(var(--cw-card-radius) - var(--cw-radius-inset))` in three places. A menu
row at `sm` inside a panel at `lg` is that rule, not a mistake; a 48px control
standing on the page at `sm` is a mistake. Telling those two apart needs the
law to grow a clause about nesting, and that clause needs a decision about
whether the step-down is one rung or the parent minus its own padding.

Until then: the burn-down is named, and nothing new joins it.

---

# The network, same method (2026-09-07)

The five static landings were out of scope for everything above, and the reason
was real: they never load `globals.css`, they paint their own `--cw-net-*` skin,
and both `guard:buttons` and `guard:geometry` excluded them by path. So the
question this pass had to answer first was not "how do we fix them" but **one
scale for the product and the network, or two?**

## Inventory

Measured over the 47 shipped landing files (`legacy/` excluded):

| | landings | platform (after the pass above) |
| --- | --- | --- |
| radius: literals vs token refs | 78 vs 176 | 0 vs ~200 |
| spacing: off-scale literals | 573 (+297 that had a token) vs 284 token refs | 66 vs 959 |
| font-size: literals | 368 (+77 clamps) vs 89 token refs | 26 vs 260 |

Roughly three times the drift the whole platform carried that morning.

## The finding that answered the question

The network's own radius scale — `--r-sm / --r-md / --r-lg / --r-pill` in
`network-tokens.css`, 133 references, the dominant vocabulary on every landing —
was **11.2 / 16 / 22.4 / 999px** against the platform's **12 / 16 / 20 / 999**.

That is not a second scale with its own reasoning. It is the same scale drawn a
second time, with `md` landing exactly and the other two mistyped by 0.8 and
2.4px. Nothing in the network ever asked for 11.2px.

The literals said the same thing from the other side. Of 43 hand-typed radius
values, **17 are exactly a platform step** and **16 more are within 2px of one**
(13→12, 14→12, 12.8→12, 27.2→28, 18→16). Only ten are genuinely their own, and
those are line caps (`2px`) and `pill` spelled out as `999px`.

So: **one scale.** The skin is where the network differs — its colours, its
grounds, its typography — and geometry was never part of the skin.

## What changed

- `scripts/generate-design-tokens.mjs` delivers the **whole radius scale** to the network, not just the button's step. Before, only `--cw-radius-md` and `--cw-radius-btn` travelled, which is exactly why the network had to invent the rest.
- `--r-sm/md/lg/pill` are **aliases onto those steps**. The 133 references keep working and move with the product; `sm` gains 0.8px, `lg` loses 2.4px, `md` and `pill` do not move at all.
- `irem.theme.css` and `short-b.theme.css` re-declared the same four values locally. Deleted — the shared file's own header already said these landings no longer carry per-page radius.
- `guard:geometry` now counts the landings too, at **their own baseline**: literal radius (38) and off-scale spacing (119), each ratcheted per file. The box↔band law is deliberately *not* asked of them — a landing is a composed page, not a set of contracted controls, and its sections size themselves.

## What was deliberately left

The 573 off-scale spacing values and the 368 literal font sizes. Both are real
drift and neither is urgent: the landings are stable, rarely edited, and their
rhythm is a composition rather than a system. The ratchet holds the count where
it is, so the next edit cannot make it worse, and the burn-down is available
whenever a landing is being worked on anyway. Fixing 941 values blind, on five
pages that convert traffic, with no way to verify most of them, is the kind of
sweep this audit exists to argue against.
