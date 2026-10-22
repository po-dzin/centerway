-- One name and one face per person (G 2026-10-22).
--
-- An author carried two of each: Google's on the account («Gleb P.») and
-- their own on the author profile («Центр П.»). `platform_users` is a mirror
-- of `auth.users` kept by `sync_platform_user_from_auth`, and comments, the
-- admin lists and the emails read it, so they said the Google name.
--
-- From now on the mirror takes, in order:
--   1. the name and photo the person chose — `cw_name` / `cw_avatar` in the
--      account's metadata, written when an author profile is saved
--      (src/lib/auth/accountIdentity.ts). Google never sends these keys, so a
--      Google sign-in does not overwrite them;
--   2. their author profile, for authors who have not saved it since;
--   3. what Google gave.
--
-- Nothing here writes to `auth.users`: the backfill below touches only the
-- public mirror, and the account metadata catches up the next time the author
-- opens or saves their profile.

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
  author_name text;
  author_photo text;
BEGIN
  SELECT a.name, a.photo ->> 'src'
    INTO author_name, author_photo
    FROM public.lms_authors a
   WHERE a.auth_user_id = NEW.id
   LIMIT 1;

  user_email := lower(NEW.email);
  user_full_name := COALESCE(
    NULLIF(btrim(NEW.raw_user_meta_data ->> 'cw_name'), ''),
    NULLIF(btrim(author_name), ''),
    NEW.raw_user_meta_data ->> 'full_name',
    NEW.raw_user_meta_data ->> 'name'
  );
  user_avatar := COALESCE(
    NULLIF(btrim(NEW.raw_user_meta_data ->> 'cw_avatar'), ''),
    NULLIF(btrim(author_photo), ''),
    NEW.raw_user_meta_data ->> 'avatar_url',
    NEW.raw_user_meta_data ->> 'picture'
  );
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

-- Authors already here: the mirror takes their profile's name and photo now.
UPDATE public.platform_users pu
   SET full_name = a.name,
       avatar_url = COALESCE(NULLIF(btrim(a.photo ->> 'src'), ''), pu.avatar_url)
  FROM public.lms_authors a
 WHERE a.auth_user_id = pu.auth_user_id
   AND NULLIF(btrim(a.name), '') IS NOT NULL;
