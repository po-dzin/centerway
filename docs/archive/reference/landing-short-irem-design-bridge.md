# Landing Short/IREM Design Bridge

Date: 2026-06-30  
Status: archived local reference

This note condenses two former root-level local docs:

- `docs/landing-short-irem-product-palettes.md`
- `docs/landing-short-irem-size-policy.md`

They were useful as implementation aids for the `short` and `irem` landings, but they do
not belong in the active `docs/` root because they are product-specific derivations rather
than repo-wide operating canon.

## Scope

This file preserves the practical bridge rules that mattered:

- how `short` and `irem` map visual identity through semantic `--landing-*` tokens;
- how landing card families should size by role instead of by forced equal height.

## Palette Bridge Rule

For `short` and `irem`, component styles should consume semantic landing tokens only:

- route/action: `--landing-color-primary`, `--landing-color-primary-strong`, `--landing-color-accent`
- surfaces: `--landing-color-surface-*`
- status/trust: `--landing-color-state-*`, `--landing-color-border-*`
- text emphasis: `--landing-color-text-*`

Do not use ad hoc raw color refs inside landing components. Product identity must pass
through the bridge layer: `role -> semantic token -> component`.

### Product temperature

- `short`: warm route with neutral trust counterweight
- `irem`: cool route with warm decision/accent counterweight

### White control

Pure white should not be the default landing card color. Use it only when it improves
separation without breaking route atmosphere.

## Size Bridge Rule

Landing blocks should size by semantic family, with intrinsic height as the default.

### Families that should stay intrinsic

- compact info cards
- feature grid cards
- program/list cards
- summary cards
- decision cards

### Families that may use stronger size constraints

- media tiles
- media frames
- paired compositions

### Unification order

Use this order when tuning landing layout:

1. role
2. width / max-width
3. padding
4. media slot
5. gap
6. height only when the family is truly parallel

## Reading Note

If these route-specific bridge rules ever become durable cross-product canon, the
generalized rule belongs in RAverse, most likely inside:

- `Лендинги.md`
- `Дизайн-токены.md`
- `Блоки и компоненты.md`
