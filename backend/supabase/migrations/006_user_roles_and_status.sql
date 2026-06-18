-- ============================================================
-- SOUNDWAVE - User Roles and Account Status
-- Roles:
--   admin    - full platform control
--   creator  - can upload/manage own catalog
--   listener - can listen, like, and manage own playlists
-- ============================================================

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'listener'
  CHECK (role IN ('admin', 'creator', 'listener'));

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS account_status TEXT NOT NULL DEFAULT 'active'
  CHECK (account_status IN ('active', 'blocked', 'deleted'));

UPDATE public.users
SET role = 'creator'
WHERE is_artist = true
  AND role = 'listener';

CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_users_account_status ON public.users(account_status);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  clean_phone TEXT;
  fallback_email TEXT;
  base_username TEXT;
BEGIN
  clean_phone := NULLIF(REGEXP_REPLACE(COALESCE(NEW.phone, ''), '[^0-9]+', '', 'g'), '');
  fallback_email := CASE
    WHEN clean_phone IS NOT NULL THEN 'phone_' || clean_phone || '@phone.soundwave.local'
    ELSE NEW.id::TEXT || '@user.soundwave.local'
  END;
  base_username := COALESCE(
    NULLIF(LOWER(SPLIT_PART(NEW.email, '@', 1)), ''),
    CASE
      WHEN clean_phone IS NOT NULL THEN 'user_' || RIGHT(clean_phone, 6)
      ELSE 'user_' || LEFT(NEW.id::TEXT, 8)
    END
  );

  INSERT INTO public.users (
    id,
    email,
    username,
    display_name,
    phone,
    phone_verified,
    role,
    account_status
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.email, fallback_email),
    base_username || '_' || FLOOR(RANDOM() * 9999)::TEXT,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name'
    ),
    NEW.phone,
    NEW.phone_confirmed_at IS NOT NULL,
    'listener',
    'active'
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    phone = COALESCE(EXCLUDED.phone, public.users.phone),
    phone_verified = public.users.phone_verified OR EXCLUDED.phone_verified;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

NOTIFY pgrst, 'reload schema';
