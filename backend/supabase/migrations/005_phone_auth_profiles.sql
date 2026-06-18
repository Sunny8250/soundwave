-- ============================================================
-- SOUNDWAVE - Phone Auth Profile Support
-- Run this before enabling phone OTP sign-in in Supabase Auth.
-- ============================================================

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS phone TEXT UNIQUE;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN NOT NULL DEFAULT false;

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
    phone_verified
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
    NEW.phone_confirmed_at IS NOT NULL
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    phone = COALESCE(EXCLUDED.phone, public.users.phone),
    phone_verified = public.users.phone_verified OR EXCLUDED.phone_verified;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

UPDATE public.users u
SET
  phone = au.phone,
  phone_verified = au.phone_confirmed_at IS NOT NULL
FROM auth.users au
WHERE u.id = au.id
  AND au.phone IS NOT NULL
  AND (u.phone IS NULL OR u.phone = au.phone);

NOTIFY pgrst, 'reload schema';
