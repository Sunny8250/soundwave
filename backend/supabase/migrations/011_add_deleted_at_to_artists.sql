-- 011_add_deleted_at_to_artists.sql
-- Add deleted_at column to artists for soft-delete
ALTER TABLE public.artists
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_artists_deleted_at ON public.artists (deleted_at);
