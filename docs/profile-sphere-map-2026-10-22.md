# Карта сфер — the profile's map of a life

Status: **implemented 2026-10-22** (branch `claude/profile-sphere-map`). The
scales come from the autumn programme's design («Осінній цикл»), where the seven
life spheres are the programme's axes; this is their first home in the product.

## Contract

- Surface: the profile's «Карта» tab (G 23.10). `/profile/map` is the profile
  opened on that tab, under the same room; the tab switches in place from
  «Огляд», and the map tile on the profile's first screen («Продовжити | Карта
  | Доша») opens it. It was a page of its own until 23.10.
- Semantic role: a self-assessment the person keeps — where each sphere is now
  (A) and where they want it a year from now (B), with up to three spheres in
  focus for the cycle.
- User question: *where is my attention going, and where do I want it to go?*
- Token source: existing platform card, ink and material recipes; the radar
  draws with `--cw-sem-embodied`, `--cw-rule-ink` and the platform's muted and
  border tokens. No new
  visual family.
- Content source: one row per person in `profile_sphere_maps`
  (`supabase/migrations/20261022150000_profile_sphere_map.sql`), read and
  written through `GET`/`PUT /api/platform/users/me/sphere-map`. The pure rules
  (axes, validation, radar geometry, history) live in
  `src/lib/profile/sphereMap.ts`; `sphereMapStore.ts` is the only code that
  touches the table.
- Route boundary: personal host only, `noindex`. The table has owner-only RLS
  (select, insert, update, delete) and no staff, support or author policy: an
  admin cannot read a person's map.

## Block composition

- **Cabinet card** (`SphereMapCard`): a radar thumbnail and the focus line, one
  crossing to the map. Shown to every signed-in person, not only learners: the
  map is about a life, not a course.
- **Map page** (`SphereMapView`): an A/B switch, a 0–10 scale per sphere, focus
  toggles (at most three), an optional one-line «живий приклад» per sphere, and
  the history.

## Decisions

- **Keyed by axis, not by name.** The sphere names are the programme's working
  names (G, 2026-10-22) and will change; scores are stored under a stable id,
  so a rename is a copy edit. An id is never reused for another sphere.
- **Whole-map saves, one at a time.** A tap changes the screen at once and the
  map is sent ~0.7 s after the last tap. Only one save is in flight; a later
  change waits for it and goes next, so an older write can never land after a
  newer one.
- **History is the server's.** The server snapshots A scores per day and phase
  (a snapshot only when A changes; same-day snapshots in one phase merge; the first «на старті» snapshot survives the cap of
  100). The client takes only the history from the server's answer, never the
  spheres, so a tap made during a save is not undone.
- **SymbolField sync is not here.** Syncing the map to SymbolField is a later
  wave, and only for G, Евгений and people who opt in.

## Canon

This is CenterWay's own product surface, not cross-project behaviour, so no
RAverse canon note changes with it.
