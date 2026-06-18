-- 010_add_deleted_at_to_tracks.sql
-- Add deleted_at column to tracks for soft-delete
ALTER TABLE public.tracks
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Optional index to speed up queries filtering non-deleted rows
CREATE INDEX IF NOT EXISTS idx_tracks_deleted_at ON public.tracks (deleted_at);
