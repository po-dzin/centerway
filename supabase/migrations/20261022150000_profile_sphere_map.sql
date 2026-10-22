-- CenterWay: карта сфер — the person's own sphere map in the profile.
--
-- WHAT THIS IS FOR
-- Seven spheres of a life, each scored twice on a 0–10 scale: A, where it is
-- now, and B, where the person wants it to be in a year. Up to three of them
-- are the cycle's focus. Chosen by the product owner on 2026-10-22; it replaces
-- a prototype that kept the same numbers in one browser's localStorage, which
-- is to say on one device and nowhere else.
--
-- KEYED BY AXIS, NOT BY NAME
-- The names («Тіло і здоров'я», «Стан і психіка», …) are working names from the
-- programme and will be renamed. Scores are stored under a stable axis id
-- (`body`, `state`, `people`, `work`, `environment`, `growth`, `rest`) so a
-- rename is a copy change and costs nobody their map. The id list lives in
-- `src/lib/profile/sphereMap.ts`; the API refuses an id it does not know, so
-- the database does not repeat the list in a CHECK it would have to migrate.
--
-- ONE ROW PER PERSON, HISTORY IN THE ROW
-- `history` is a jsonb array of snapshots of A ({ at, phase?, now }), not a
-- second table. What reads it is always the whole map at once — the radar's
-- «на старті» is the first snapshot and «зараз» is the live row — so a join
-- would buy nothing, and a second table would be a second set of policies to
-- keep private. The API coalesces saves made on the same day into one snapshot
-- and caps the array (keeping the first), so the row stays small: seven small
-- integers per entry.
--
-- PRIVATE, AND PRIVATE MEANS PRIVATE
-- Only the owner reads and writes this row. No staff policy, no author policy:
-- the same statement `lms_annotations` makes by having none. Server code goes
-- through the service role and checks the caller in TypeScript (AGENTS.md →
-- Database Rule); the policies below are defence in depth for a user token.
--
-- Idempotent throughout: safe to re-run.

CREATE TABLE IF NOT EXISTS public.profile_sphere_maps (
  auth_user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  -- { "<axis>": { "now": 0–10 | null, "goal": 0–10 | null, "note": text? } }
  spheres jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Axis ids, at most three, in the order the person picked them.
  focus text[] NOT NULL DEFAULT '{}',
  -- [{ "at": timestamptz, "phase": text?, "now": { "<axis>": 0–10 } }], oldest first.
  history jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT profile_sphere_maps_spheres_object CHECK (jsonb_typeof(spheres) = 'object'),
  CONSTRAINT profile_sphere_maps_history_array CHECK (jsonb_typeof(history) = 'array'),
  CONSTRAINT profile_sphere_maps_focus_max CHECK (cardinality(focus) <= 3)
);

CREATE OR REPLACE FUNCTION public.profile_sphere_maps_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_profile_sphere_maps_updated_at') THEN
    CREATE TRIGGER trg_profile_sphere_maps_updated_at
      BEFORE UPDATE ON public.profile_sphere_maps
      FOR EACH ROW EXECUTE FUNCTION public.profile_sphere_maps_set_updated_at();
  END IF;
END $$;

ALTER TABLE public.profile_sphere_maps ENABLE ROW LEVEL SECURITY;

-- The owner, and only the owner. Four policies rather than FOR ALL, so the
-- write side carries WITH CHECK and a row cannot be moved onto another account.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profile_sphere_maps' AND policyname = 'Owner can view own sphere map') THEN
    EXECUTE $p$ CREATE POLICY "Owner can view own sphere map" ON public.profile_sphere_maps FOR SELECT TO authenticated
      USING (auth_user_id = auth.uid()) $p$;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profile_sphere_maps' AND policyname = 'Owner can create own sphere map') THEN
    EXECUTE $p$ CREATE POLICY "Owner can create own sphere map" ON public.profile_sphere_maps FOR INSERT TO authenticated
      WITH CHECK (auth_user_id = auth.uid()) $p$;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profile_sphere_maps' AND policyname = 'Owner can update own sphere map') THEN
    EXECUTE $p$ CREATE POLICY "Owner can update own sphere map" ON public.profile_sphere_maps FOR UPDATE TO authenticated
      USING (auth_user_id = auth.uid()) WITH CHECK (auth_user_id = auth.uid()) $p$;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profile_sphere_maps' AND policyname = 'Owner can delete own sphere map') THEN
    EXECUTE $p$ CREATE POLICY "Owner can delete own sphere map" ON public.profile_sphere_maps FOR DELETE TO authenticated
      USING (auth_user_id = auth.uid()) $p$;
  END IF;
END $$;
