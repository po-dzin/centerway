# Claude Design — staged prompt template

A blank pack for handing a design system to Claude Design (design.claude.com)
without drift from what the code already ships. Fill the angle-bracket slots and
delete this line. Nothing here is project-specific; a filled copy belongs next
to the project's own design brief, not in this file.

## How a session runs

```
Stage 0        pasted first in EVERY new Claude Design session
Stage 0.5      pasted immediately after, same session
Stage 1..4     one stage per request, in order, verified before moving on
```

Order matters: foundations before components, components before screens. Asking
for a screen first produces a screen with invented tokens under it, and the
invention is what later drifts.

Two rules that save the most rework:

- **Attach, don't paraphrase.** Attach the real token file and the rendered
  styleguide to the session. The prompt states the law; the files carry the
  values.
- **State the target, not the current state.** Where the code lags the design,
  hand over the target and track the gap in a ledger. A brief that describes a
  half-migrated runtime teaches the tool to generate a half-migrated system.

---

## STAGE 0 — System context

> Paste first, every session. Everything else assumes it.

```
You are building UI for <PRODUCT> — <ONE LINE: what it is, in the product's own
terms>.
Not <NEAREST WRONG GENRE 1>, not <NEAREST WRONG GENRE 2>, not <NEAREST WRONG
GENRE 3>.

CORE LAWS (never violate):
1. <LAW 1 — the one rule that, if broken, makes it stop being this product>
2. <LAW 2>
3. <LAW 3>
4. <LAW 4 — usually the token hierarchy: primitive -> semantic -> component;
   never a raw literal where a role exists>
5. <LAW 5>

GROUND (default theme): app <HEX> · surface <HEX> · border <HEX or alpha> ·
text <HEX> / <HEX> / <HEX> ·
PRIMARY action <HEX> (label on it <HEX>) ·
accent <HEX> — used only for <THE ONE THING IT MEANS> ·
status: success <HEX> · warning <HEX> · info <HEX> · error <HEX> ·
overlay backdrop <VALUE>.

SECOND THEME (<NAME>): app <HEX> · surface <HEX> · border <HEX> ·
text <HEX> / <HEX> · action <HEX> (label on it <HEX>).
<ONE LINE: how the second theme differs in kind, not just in value — e.g. it is
a different light on the same material, not an inversion>

TYPE: <UI FAMILY> (interface) + <SECOND FAMILY> (<WHAT IT IS RESERVED FOR>).
Scale: <ROLE> <SIZE>/<LINE> · <ROLE> <SIZE>/<LINE> · <ROLE> <SIZE>/<LINE> ·
<ROLE> <SIZE>/<LINE>.
Hierarchy comes from <WEIGHT / SIZE / SPACING> before colour.

SPACING: only <N> / <N> / <N> / <N> / <N>. Density bands: <NAME> <N>/<N> ·
<NAME> <N>/<N> · <NAME> <N>/<N>.

RADII: <ROLE> <N> · <ROLE> <N> · <ROLE> <N> · pill 9999.

MATERIAL: <HOW SURFACES ARE MADE — opacity range, blur range, grain/texture,
and what is explicitly banned (bevels, rims, speculars, inner glows...)>.

MOTION: <N>ms <WHAT> · <N>ms <WHAT> · <N>ms <WHAT, IF ANY>.
Easing <CUBIC-BEZIER>. Motion communicates state change, never decorates.

SHADOWS: <ROLE> <VALUE> · <ROLE> <VALUE> · <ROLE> <VALUE>.

STATE GRAMMAR (every interactive element): default · hover · focus-visible ·
selected · active · disabled · loading · error.
Focus ring = <THE RULE>, always visible.

HIT TARGETS: <CONTEXT> >=<N> · <CONTEXT> >=<N> · <CONTEXT> >=<N>.

Z-LADDER (absolute, single source): <name> <N> · <name> <N> · <name> <N> ·
<name> <N> · <name> <N> · <name> <N>.

ICONOGRAPHY / SIGNS: <THE ALPHABET — the two or three primitives every mark is
built from, how they compose, the smallest size a sign must stay readable at>.

EXPLICITLY AVOID: <THE LOOK THIS PRODUCT IS MOST OFTEN MISTAKEN FOR>,
<A TREND THAT WOULD SWALLOW IT>, <A SECOND ACCENT COLOUR>, <ANYTHING PREVIOUSLY
REJECTED BY NAME>.
```

**Filling notes.** The `EXPLICITLY AVOID` block does more work than any other
line — a model reaches for the genre average unless told which average. Write it
from real rejections, not from taste. Same for `Not <WRONG GENRE>` in the
opening: name the three things reviewers keep mistaking the product for.

---

## STAGE 0.5 — Full token language

> Paste second. This is the *target* language, including roles the code has not
> implemented yet.

```
STAGE 0.5 — FULL TOKEN LANGUAGE (canonical target; treat as law even where the
runtime lags)

TYPE ROLES (semantic): <role> <size>/<line>·<weight> · <role> <size>/<line>·<weight> ·
<role> <size>/<line>·<weight>. Weights: <LIST>. Nothing heavier.

SPACING LADDER (the only values): <LIST>.

Z-LADDER (absolute): <LIST>.

MOTION: <LIST>. Easing <VALUE> everywhere.

STATE GRAMMAR (all eight, for every interactive element):
default · hover (<HOW>) · focus-visible (<HOW>) · selected (<HOW>) ·
active (<HOW>) · disabled (<HOW>) · loading (<HOW>) · error (<HOW>).

ACCENT ONTOLOGY (<N> channels):
<CHANNEL 1> = <WHAT IT MEANS> — <WHERE IT MAY APPEAR, AND WHERE IT MAY NOT>
<CHANNEL 2> = <...>
<CHANNEL 3> = <...>

SURFACE LADDER: <NAME> <OPACITY/DEPTH> -> <NAME> <...> -> <NAME> <...>.
Groups differ only by <THE ONE VARIABLE THAT SEPARATES THEM>.

NAMING GRAMMAR: <prefix>-<layer>-<role>-<variant>. A component may read
<WHICH LAYER> and never <WHICH LAYER>.
```

**Filling notes.** `ACCENT ONTOLOGY` is where most systems are actually decided:
say what each colour *means*, not where it appears. A channel defined by meaning
survives a redesign; one defined by placement does not.

---

## STAGE 1 — Foundations

```
Build the foundations of <PRODUCT> as <N> guideline cards: <colour (per theme)>,
<type roles>, <spacing ladder>, <radii + surfaces>, <shadows>, <motion>,
<state grammar>, <icon grid>.

Each card: a specimen, the token name under every specimen, and the rule in one
sentence. No prose paragraphs, no marketing.
Every value must come from the attached token file. If a value you need has no
token, stop and list what is missing instead of inventing one.
```

## STAGE 2 — Components

```
Build <COMPONENT FAMILY> for <PRODUCT>: <list the variants that actually exist —
e.g. primary / secondary / ghost / danger, in <N> sizes>.

Show all eight states for every variant, both themes.
Compose from the Stage 1 foundations only.
Hit targets: <VALUES>. Focus ring: <THE RULE>.
Where a variant would need a value the foundations do not have, say so rather
than adding one.
```

## STAGE 3 — Screens

```
Assemble <SCREEN NAME> for <PRODUCT>.
Purpose: <THE ONE QUESTION THIS SCREEN ANSWERS>.
Regions: <LIST, WITH THEIR OWNERSHIP — what outranks what>.
Density: <BAND>. Breakpoints: <LIST>.
Use only components built in Stage 2. A new component means going back to
Stage 2, not inventing it here.
```

## STAGE 4 — Verification

```
Compare what you generated against the attached styleguide and list, as a table:
every value you used that is not in the token file · every state you could not
express with existing tokens · every place you chose a literal over a role.
Do not fix anything. Report only.
```

**Filling notes.** Stage 4 is the whole point of the pack. A generated system
that cannot say where it improvised is indistinguishable from one that did not
improvise, and the difference shows up two months later as drift.

---

## Specimen card skeleton

Cards in the Design System pane come from a first-line marker. `card.template.html`
next to this file is a blank one — copy it per specimen.

```html
<!-- @dsCard group="<SECTION>" viewport="<W>x<H>" name="<CARD NAME>" subtitle="<WHAT VARIES>" -->
```

Author specimens **as cards in the project**, not as standalone pages: a palette
study or a state matrix belongs beside the system it argues about, or nobody
finds it again.

---

## Worked micro-example

A deliberately dull filled fragment, to show the shape only:

```
You are building UI for Ledger — a double-entry bookkeeping console for
accountants who live in it eight hours a day.
Not a fintech landing page, not a consumer banking app, not a BI dashboard.

CORE LAWS:
1. Numbers outrank everything: no ornament may sit between the eye and a figure.
2. Colour carries one meaning only — debit/credit sign. Never brand, never mood.
3. Density is a feature: the default row height is the tightest the type allows.
4. primitive -> semantic -> component; a component never reads a primitive.
5. Nothing animates while a figure is being read.

EXPLICITLY AVOID: the purple-gradient SaaS look, card-in-card-in-card layouts,
a second accent colour, icons standing in for words in a numeric column.
```

Note what the example does *not* do: it never says "modern", "clean", or
"beautiful". Every line is a constraint that can be violated, which is the only
kind of line a generator can obey.
