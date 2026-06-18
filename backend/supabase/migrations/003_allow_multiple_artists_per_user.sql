-- Allow one user/studio account to manage multiple catalog artists.
ALTER TABLE public.artists
  DROP CONSTRAINT IF EXISTS artists_user_id_key;

CREATE INDEX IF NOT EXISTS idx_artists_user_id
  ON public.artists(user_id);
