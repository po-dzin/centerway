-- CenterWay: platform users table + Google auth profile sync foundation
-- Run in Supabase SQL editor (public schema).

CREATE TABLE IF NOT EXISTS public.platform_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NULL,
  full_name text NULL,
  avatar_url text NULL,
  provider text NULL,
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'coach', 'admin', 'support')),
  marketing_opt_in boolean NOT NULL DEFAULT false,
  onboarding_state text NOT NULL DEFAULT 'new' CHECK (onboarding_state IN ('new', 'profile_completed', 'test_completed', 'active')),
  last_sign_in_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_platform_users_email ON public.platform_users (email);
CREATE INDEX IF NOT EXISTS idx_platform_users_provider ON public.platform_users (provider);
CREATE INDEX IF NOT EXISTS idx_platform_users_last_sign_in_at ON public.platform_users (last_sign_in_at DESC);

CREATE OR REPLACE FUNCTION public.platform_users_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_platform_users_updated_at') THEN
    CREATE TRIGGER trg_platform_users_updated_at
      BEFORE UPDATE ON public.platform_users
      FOR EACH ROW EXECUTE FUNCTION public.platform_users_set_updated_at();
  END IF;
END $$;

-- Auto-sync on auth.users insert/update.
CREATE OR REPLACE FUNCTION public.sync_platform_user_from_auth()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  user_email text;
  user_full_name text;
  user_avatar text;
  user_provider text;
BEGIN
  user_email := lower(NEW.email);
  user_full_name := COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name');
  user_avatar := COALESCE(NEW.raw_user_meta_data ->> 'avatar_url', NEW.raw_user_meta_data ->> 'picture');
  user_provider := COALESCE(NEW.raw_app_meta_data ->> 'provider', 'email');

  INSERT INTO public.platform_users (auth_user_id, email, full_name, avatar_url, provider, last_sign_in_at)
  VALUES (NEW.id, user_email, user_full_name, user_avatar, user_provider, now())
  ON CONFLICT (auth_user_id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    avatar_url = EXCLUDED.avatar_url,
    provider = EXCLUDED.provider,
    last_sign_in_at = now();

  RETURN NEW;
END;
$$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_auth_users_sync_platform_user_insert') THEN
    CREATE TRIGGER trg_auth_users_sync_platform_user_insert
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION public.sync_platform_user_from_auth();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_auth_users_sync_platform_user_update') THEN
    CREATE TRIGGER trg_auth_users_sync_platform_user_update
      AFTER UPDATE OF email, raw_user_meta_data, raw_app_meta_data, last_sign_in_at ON auth.users
      FOR EACH ROW EXECUTE FUNCTION public.sync_platform_user_from_auth();
  END IF;
END $$;

-- Backfill existing auth users.
INSERT INTO public.platform_users (auth_user_id, email, full_name, avatar_url, provider, last_sign_in_at)
SELECT
  au.id,
  lower(au.email),
  COALESCE(au.raw_user_meta_data ->> 'full_name', au.raw_user_meta_data ->> 'name'),
  COALESCE(au.raw_user_meta_data ->> 'avatar_url', au.raw_user_meta_data ->> 'picture'),
  COALESCE(au.raw_app_meta_data ->> 'provider', 'email'),
  COALESCE(au.last_sign_in_at, now())
FROM auth.users au
ON CONFLICT (auth_user_id) DO NOTHING;

ALTER TABLE public.platform_users ENABLE ROW LEVEL SECURITY;

-- Users can view/update their own profile.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'platform_users' AND policyname = 'Users can view own platform profile') THEN
    EXECUTE $p$ CREATE POLICY "Users can view own platform profile"
      ON public.platform_users FOR SELECT
      USING (auth.uid() = auth_user_id) $p$;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'platform_users' AND policyname = 'Users can update own platform profile') THEN
    EXECUTE $p$ CREATE POLICY "Users can update own platform profile"
      ON public.platform_users FOR UPDATE
      USING (auth.uid() = auth_user_id)
      WITH CHECK (auth.uid() = auth_user_id) $p$;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'platform_users' AND policyname = 'Admins and Support can view platform_users') THEN
    EXECUTE $p$ CREATE POLICY "Admins and Support can view platform_users"
      ON public.platform_users FOR SELECT
      USING (public.get_my_role() IN ('admin', 'support')) $p$;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'platform_users' AND policyname = 'Admins can manage platform_users') THEN
    EXECUTE $p$ CREATE POLICY "Admins can manage platform_users"
      ON public.platform_users FOR ALL
      USING (public.get_my_role() = 'admin') $p$;
  END IF;
END $$;

-- Link customers to auth user when possible.
UPDATE public.customers c
SET auth_user_id = pu.auth_user_id
FROM public.platform_users pu
WHERE c.auth_user_id IS NULL
  AND c.email IS NOT NULL
  AND pu.email IS NOT NULL
  AND lower(c.email) = lower(pu.email);
