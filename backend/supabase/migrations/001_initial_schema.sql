-- ============================================================
-- SOUNDWAVE — Initial Database Schema
-- Migration: 001_initial_schema.sql
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================================

-- Enable UUID extension (already enabled on Supabase by default)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- ============================================================
-- USERS
-- Core identity table. Auth is handled by Supabase Auth.
-- This table extends auth.users with app-specific profile data.
-- ============================================================
CREATE TABLE public.users (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email           TEXT NOT NULL UNIQUE,
  username        TEXT NOT NULL UNIQUE,
  display_name    TEXT,
  avatar_url      TEXT,
  bio             TEXT,
  country         TEXT,
  date_of_birth   DATE,
  subscription_tier TEXT NOT NULL DEFAULT 'free'
                  CHECK (subscription_tier IN ('free', 'premium', 'artist_pro')),
  is_artist       BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.users IS 'App-level user profiles, extends Supabase auth.users';
COMMENT ON COLUMN public.users.subscription_tier IS 'free | premium | artist_pro';


-- ============================================================
-- ARTISTS
-- Created when a user becomes an artist via the Creator Dashboard.
-- One user can have one artist profile.
-- ============================================================
CREATE TABLE public.artists (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  slug                TEXT NOT NULL UNIQUE,
  bio                 TEXT,
  avatar_url          TEXT,
  header_image_url    TEXT,
  country             TEXT,
  is_verified         BOOLEAN NOT NULL DEFAULT false,
  monthly_listeners   INTEGER NOT NULL DEFAULT 0,
  follower_count      INTEGER NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON COLUMN public.artists.slug IS 'URL-friendly unique identifier e.g. "the-weeknd"';
COMMENT ON COLUMN public.artists.is_verified IS 'Blue tick — manually set by platform admins';


-- ============================================================
-- GENRES
-- Master genre list. Managed by admins, not user-created.
-- ============================================================
CREATE TABLE public.genres (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL UNIQUE,
  slug        TEXT NOT NULL UNIQUE,
  description TEXT,
  cover_url   TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed some base genres (added in seed file, not here)


-- ============================================================
-- ALBUMS
-- Albums, EPs, singles, and compilations.
-- A "single" is just an album with type='single' and one track.
-- ============================================================
CREATE TABLE public.albums (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  artist_id       UUID NOT NULL REFERENCES public.artists(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  slug            TEXT NOT NULL,
  type            TEXT NOT NULL DEFAULT 'album'
                  CHECK (type IN ('album', 'ep', 'single', 'compilation')),
  cover_art_url   TEXT,
  release_date    DATE,
  label           TEXT,
  upc             TEXT UNIQUE,           -- Universal Product Code
  description     TEXT,
  is_published    BOOLEAN NOT NULL DEFAULT false,
  total_tracks    INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(artist_id, slug)
);


-- ============================================================
-- TRACKS
-- The heart of the catalog. One row per song.
-- Audio files live in track_files (multiple quality levels).
-- ============================================================
CREATE TABLE public.tracks (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  album_id          UUID REFERENCES public.albums(id) ON DELETE SET NULL,
  artist_id         UUID NOT NULL REFERENCES public.artists(id) ON DELETE CASCADE,
  title             TEXT NOT NULL,
  duration_ms       INTEGER,            -- populated after processing
  track_number      INTEGER,
  isrc              TEXT UNIQUE,        -- International Standard Recording Code
  explicit          BOOLEAN NOT NULL DEFAULT false,
  license_type      TEXT NOT NULL DEFAULT 'owned'
                    CHECK (license_type IN ('owned', 'creative_commons', 'distributor', 'major_label')),

  -- Processing state
  status            TEXT NOT NULL DEFAULT 'processing'
                    CHECK (status IN ('processing', 'review', 'published', 'rejected', 'takedown')),
  raw_file_path     TEXT,               -- private S3/R2 path to master file
  processing_error  TEXT,              -- error message if processing failed

  -- Play stats
  play_count        INTEGER NOT NULL DEFAULT 0,
  like_count        INTEGER NOT NULL DEFAULT 0,

  -- Audio analysis features (populated by ML worker after upload)
  bpm               FLOAT,
  key_signature     TEXT,              -- e.g. "C major", "F# minor"
  mood              TEXT,              -- e.g. "happy", "melancholic", "energetic"
  energy            FLOAT,             -- 0.0 to 1.0
  danceability      FLOAT,             -- 0.0 to 1.0
  valence           FLOAT,             -- 0.0 to 1.0 (musical positivity)
  loudness_lufs     FLOAT,             -- for normalization
  waveform_data     JSONB,             -- array of ~1000 amplitude peaks

  published_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON COLUMN public.tracks.raw_file_path IS 'Original master — private, never streamed directly';
COMMENT ON COLUMN public.tracks.waveform_data IS 'JSON array of ~1000 float values for player scrubber';
COMMENT ON COLUMN public.tracks.loudness_lufs IS 'Used for per-track volume normalization at playback';


-- ============================================================
-- TRACK FILES
-- Every quality/format version of a track lives here.
-- One track has multiple track_files rows (128k, 256k, flac, hls…)
-- ============================================================
CREATE TABLE public.track_files (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  track_id        UUID NOT NULL REFERENCES public.tracks(id) ON DELETE CASCADE,
  quality         TEXT NOT NULL
                  CHECK (quality IN ('low', 'medium', 'high', 'lossless', 'hls')),
  format          TEXT NOT NULL
                  CHECK (format IN ('aac', 'mp3', 'flac', 'alac', 'hls')),
  file_url        TEXT NOT NULL,        -- public CDN URL
  file_size_bytes BIGINT,
  bitrate_kbps    INTEGER,
  sample_rate_hz  INTEGER,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(track_id, quality)
);

COMMENT ON COLUMN public.track_files.quality IS 'low=128k | medium=256k | high=320k | lossless=flac | hls=adaptive';


-- ============================================================
-- TRACK GENRES (junction)
-- Many-to-many: a track can have multiple genres
-- ============================================================
CREATE TABLE public.track_genres (
  track_id    UUID NOT NULL REFERENCES public.tracks(id) ON DELETE CASCADE,
  genre_id    UUID NOT NULL REFERENCES public.genres(id) ON DELETE CASCADE,
  PRIMARY KEY (track_id, genre_id)
);


-- ============================================================
-- TRACK ARTISTS (junction)
-- Handles featured artists, producers, remixers per track.
-- The primary artist is also stored on tracks.artist_id for speed.
-- ============================================================
CREATE TABLE public.track_artists (
  track_id    UUID NOT NULL REFERENCES public.tracks(id) ON DELETE CASCADE,
  artist_id   UUID NOT NULL REFERENCES public.artists(id) ON DELETE CASCADE,
  role        TEXT NOT NULL DEFAULT 'featured'
              CHECK (role IN ('primary', 'featured', 'producer', 'remixer', 'composer')),
  PRIMARY KEY (track_id, artist_id, role)
);


-- ============================================================
-- PLAYLISTS
-- User-created playlists. Collaborative playlists allow
-- multiple users to add tracks.
-- ============================================================
CREATE TABLE public.playlists (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id            UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title               TEXT NOT NULL,
  description         TEXT,
  cover_art_url       TEXT,
  is_public           BOOLEAN NOT NULL DEFAULT true,
  is_collaborative    BOOLEAN NOT NULL DEFAULT false,
  total_tracks        INTEGER NOT NULL DEFAULT 0,
  total_duration_ms   BIGINT NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================
-- PLAYLIST TRACKS (junction)
-- Ordered list of tracks in a playlist.
-- position is used for manual ordering.
-- ============================================================
CREATE TABLE public.playlist_tracks (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  playlist_id     UUID NOT NULL REFERENCES public.playlists(id) ON DELETE CASCADE,
  track_id        UUID NOT NULL REFERENCES public.tracks(id) ON DELETE CASCADE,
  added_by        UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  position        INTEGER NOT NULL,
  added_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(playlist_id, track_id),
  UNIQUE(playlist_id, position)
);


-- ============================================================
-- USER LIBRARY
-- Generic "saved items" table: tracks, albums, playlists, artists.
-- item_type + item_id replaces 4 separate saved_* tables.
-- ============================================================
CREATE TABLE public.user_library (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  item_type   TEXT NOT NULL
              CHECK (item_type IN ('track', 'album', 'playlist', 'artist')),
  item_id     UUID NOT NULL,
  saved_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, item_type, item_id)
);


-- ============================================================
-- USER FOLLOWS
-- Generic follows: user→user and user→artist in one table.
-- ============================================================
CREATE TABLE public.user_follows (
  follower_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  following_id    UUID NOT NULL,        -- can be user or artist UUID
  following_type  TEXT NOT NULL
                  CHECK (following_type IN ('user', 'artist')),
  followed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (follower_id, following_id, following_type)
);


-- ============================================================
-- LISTENING HISTORY
-- Every play event is recorded here.
-- played_ms tracks how far through the song the user got.
-- Only plays where played_ms >= 30000 count for royalties.
-- ============================================================
CREATE TABLE public.listening_history (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  track_id    UUID NOT NULL REFERENCES public.tracks(id) ON DELETE CASCADE,
  played_ms   INTEGER NOT NULL DEFAULT 0,
  completed   BOOLEAN NOT NULL DEFAULT false,
  source      TEXT CHECK (source IN (
                'playlist', 'album', 'radio', 'search',
                'recommendation', 'artist_page', 'queue', 'share'
              )),
  source_id   UUID,                     -- ID of the playlist/album it was played from
  played_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON COLUMN public.listening_history.played_ms IS 'Milliseconds played — royalty counted if >= 30000';
COMMENT ON COLUMN public.listening_history.source IS 'Where the play originated from';


-- ============================================================
-- USER QUEUE
-- The current playback queue for each user.
-- Persisted so queue survives app restarts.
-- ============================================================
CREATE TABLE public.user_queue (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  track_id        UUID NOT NULL REFERENCES public.tracks(id) ON DELETE CASCADE,
  position        INTEGER NOT NULL,
  source_type     TEXT,                 -- 'playlist' | 'album' | 'radio'
  source_id       UUID,
  added_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, position)
);


-- ============================================================
-- TRACK LIKES
-- Separate from user_library for faster like count queries.
-- ============================================================
CREATE TABLE public.track_likes (
  user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  track_id    UUID NOT NULL REFERENCES public.tracks(id) ON DELETE CASCADE,
  liked_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, track_id)
);


-- ============================================================
-- SUBSCRIPTIONS
-- Billing state per user. provider_subscription_id links to Stripe.
-- ============================================================
CREATE TABLE public.subscriptions (
  id                        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id                   UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  plan                      TEXT NOT NULL
                            CHECK (plan IN ('free', 'premium_monthly', 'premium_yearly', 'artist_pro')),
  status                    TEXT NOT NULL DEFAULT 'active'
                            CHECK (status IN ('active', 'cancelled', 'past_due', 'trialing')),
  payment_provider          TEXT CHECK (payment_provider IN ('stripe', 'google_play', 'apple')),
  provider_subscription_id  TEXT UNIQUE,
  current_period_start      TIMESTAMPTZ,
  current_period_end        TIMESTAMPTZ,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================
-- ROYALTY EVENTS
-- Financial record of what each artist is owed per play period.
-- Generated by a cron job from listening_history.
-- ============================================================
CREATE TABLE public.royalty_events (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  track_id        UUID NOT NULL REFERENCES public.tracks(id) ON DELETE CASCADE,
  artist_id       UUID NOT NULL REFERENCES public.artists(id) ON DELETE CASCADE,
  play_event_id   UUID REFERENCES public.listening_history(id) ON DELETE SET NULL,
  amount_usd      NUMERIC(10,6) NOT NULL DEFAULT 0,
  currency        TEXT NOT NULL DEFAULT 'USD',
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'confirmed', 'paid')),
  period_start    TIMESTAMPTZ,
  period_end      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================
-- NOTIFICATIONS
-- Push + in-app notifications. payload is flexible JSON.
-- ============================================================
CREATE TABLE public.notifications (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type        TEXT NOT NULL
              CHECK (type IN (
                'new_follower', 'track_liked', 'track_published',
                'track_rejected', 'new_release', 'playlist_collaborative',
                'royalty_paid', 'system'
              )),
  title       TEXT NOT NULL,
  body        TEXT,
  payload     JSONB,
  read        BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================
-- INDEXES
-- Critical for query performance. Add these on day one.
-- ============================================================

-- Tracks
CREATE INDEX idx_tracks_artist_id     ON public.tracks(artist_id);
CREATE INDEX idx_tracks_album_id      ON public.tracks(album_id);
CREATE INDEX idx_tracks_status        ON public.tracks(status);
CREATE INDEX idx_tracks_published_at  ON public.tracks(published_at DESC);

-- Albums
CREATE INDEX idx_albums_artist_id     ON public.albums(artist_id);

-- Listening history (most queried table)
CREATE INDEX idx_listening_user_time  ON public.listening_history(user_id, played_at DESC);
CREATE INDEX idx_listening_track_id   ON public.listening_history(track_id);

-- Playlists
CREATE INDEX idx_playlist_tracks_playlist ON public.playlist_tracks(playlist_id, position);

-- Library
CREATE INDEX idx_library_user_type    ON public.user_library(user_id, item_type);

-- Follows
CREATE INDEX idx_follows_follower     ON public.user_follows(follower_id);
CREATE INDEX idx_follows_following    ON public.user_follows(following_id, following_type);

-- Notifications
CREATE INDEX idx_notifications_user   ON public.notifications(user_id, created_at DESC, read);

-- Royalties
CREATE INDEX idx_royalties_artist     ON public.royalty_events(artist_id, status);

-- Queue
CREATE INDEX idx_queue_user           ON public.user_queue(user_id, position);


-- ============================================================
-- UPDATED_AT TRIGGER
-- Automatically updates updated_at on every UPDATE.
-- Applied to all tables that have updated_at.
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trg_artists_updated_at
  BEFORE UPDATE ON public.artists
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trg_albums_updated_at
  BEFORE UPDATE ON public.albums
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trg_tracks_updated_at
  BEFORE UPDATE ON public.tracks
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trg_playlists_updated_at
  BEFORE UPDATE ON public.playlists
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trg_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


-- ============================================================
-- NEW USER TRIGGER
-- When someone signs up via Supabase Auth, automatically
-- create their public.users row.
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, username, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    -- Generate a default username from email prefix
    LOWER(SPLIT_PART(NEW.email, '@', 1)) || '_' || FLOOR(RANDOM() * 9999)::TEXT,
    COALESCE(NEW.raw_user_meta_data->>'full_name', SPLIT_PART(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ============================================================
-- PLAY COUNT TRIGGER
-- Automatically increments tracks.play_count on each
-- listening_history insert where played_ms >= 30000.
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_play_count()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.played_ms >= 30000 THEN
    UPDATE public.tracks
    SET play_count = play_count + 1
    WHERE id = NEW.track_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_increment_play_count
  AFTER INSERT ON public.listening_history
  FOR EACH ROW EXECUTE FUNCTION public.handle_play_count();


-- ============================================================
-- LIKE COUNT TRIGGER
-- Keeps tracks.like_count in sync with track_likes table.
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_like_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.tracks SET like_count = like_count + 1 WHERE id = NEW.track_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.tracks SET like_count = GREATEST(like_count - 1, 0) WHERE id = OLD.track_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_track_like_count
  AFTER INSERT OR DELETE ON public.track_likes
  FOR EACH ROW EXECUTE FUNCTION public.handle_like_count();


-- ============================================================
-- FOLLOWER COUNT TRIGGER
-- Keeps artists.follower_count in sync with user_follows.
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_artist_follower_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.following_type = 'artist' THEN
    UPDATE public.artists SET follower_count = follower_count + 1 WHERE id = NEW.following_id;
  ELSIF TG_OP = 'DELETE' AND OLD.following_type = 'artist' THEN
    UPDATE public.artists SET follower_count = GREATEST(follower_count - 1, 0) WHERE id = OLD.following_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_artist_follower_count
  AFTER INSERT OR DELETE ON public.user_follows
  FOR EACH ROW EXECUTE FUNCTION public.handle_artist_follower_count();
