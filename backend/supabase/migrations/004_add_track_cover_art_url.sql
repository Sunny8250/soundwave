-- Store artwork for standalone track uploads.
-- Album tracks can still inherit artwork from albums.cover_art_url.
ALTER TABLE public.tracks
  ADD COLUMN IF NOT EXISTS cover_art_url TEXT;

UPDATE public.tracks AS t
SET cover_art_url = a.cover_art_url
FROM public.albums AS a
WHERE t.album_id = a.id
  AND t.cover_art_url IS NULL
  AND a.cover_art_url IS NOT NULL;
