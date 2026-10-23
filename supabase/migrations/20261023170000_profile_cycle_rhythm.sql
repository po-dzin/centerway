-- CenterWay: the cycle around the sphere map, and «Мій ритм» (G 2026-10-23).
--
-- The participant tool of the autumn programme lived in a prototype that kept
-- it in one browser's localStorage. It moves into the person's own row:
--
--   cycle  — the five phases, the person's names/order/set of spheres, B in
--            words, the bridge (year → week → day step), the week of marks,
--            A′ after the cycle and the three review answers;
--   rhythm — day types, each with slots, time budgets and the blocks placed in
--            them (library blocks or the day steps of focus spheres).
--
-- Shapes are validated in TypeScript (src/lib/profile/cycle.ts) on every write;
-- the database only insists both are objects. Private exactly as the row is:
-- the existing owner-only policies cover the new columns.
--
-- Idempotent.

ALTER TABLE public.profile_sphere_maps
  ADD COLUMN IF NOT EXISTS cycle jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS rhythm jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.profile_sphere_maps DROP CONSTRAINT IF EXISTS profile_sphere_maps_cycle_object;
ALTER TABLE public.profile_sphere_maps ADD CONSTRAINT profile_sphere_maps_cycle_object CHECK (jsonb_typeof(cycle) = 'object');

ALTER TABLE public.profile_sphere_maps DROP CONSTRAINT IF EXISTS profile_sphere_maps_rhythm_object;
ALTER TABLE public.profile_sphere_maps ADD CONSTRAINT profile_sphere_maps_rhythm_object CHECK (jsonb_typeof(rhythm) = 'object');
