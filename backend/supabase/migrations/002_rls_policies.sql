-- ============================================================
-- SOUNDWAVE — Row Level Security (RLS) Policies
-- Migration: 002_rls_policies.sql
-- Run AFTER 001_initial_schema.sql
--
-- RLS ensures users can only access data they're allowed to.
-- Without this, anyone with your API key can read everything.
-- ============================================================

-- Enable RLS on every table
ALTER TABLE public.users             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.artists           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.albums            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tracks            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.track_files       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.genres            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.track_genres      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.track_artists     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playlists         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playlist_tracks   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_library      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_follows      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listening_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_queue        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.track_likes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.royalty_events    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications     ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- USERS
-- ============================================================

-- Anyone logged in can read any public profile
CREATE POLICY "users_read_public"
  ON public.users FOR SELECT
  USING (true);

-- Users can only update their own profile
CREATE POLICY "users_update_own"
  ON public.users FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Users are created automatically via trigger (no direct insert)


-- ============================================================
-- ARTISTS
-- ============================================================

-- Anyone can read artist profiles
CREATE POLICY "artists_read_all"
  ON public.artists FOR SELECT
  USING (true);

-- Only the owning user can create their artist profile
CREATE POLICY "artists_insert_own"
  ON public.artists FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Only the owning user can update their artist profile
CREATE POLICY "artists_update_own"
  ON public.artists FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- ============================================================
-- ALBUMS
-- ============================================================

-- Anyone can read published albums
CREATE POLICY "albums_read_published"
  ON public.albums FOR SELECT
  USING (
    is_published = true
    OR artist_id IN (
      SELECT id FROM public.artists WHERE user_id = auth.uid()
    )
  );

-- Only the artist can create albums
CREATE POLICY "albums_insert_own_artist"
  ON public.albums FOR INSERT
  WITH CHECK (
    artist_id IN (
      SELECT id FROM public.artists WHERE user_id = auth.uid()
    )
  );

-- Only the artist can update their albums
CREATE POLICY "albums_update_own_artist"
  ON public.albums FOR UPDATE
  USING (
    artist_id IN (
      SELECT id FROM public.artists WHERE user_id = auth.uid()
    )
  );


-- ============================================================
-- TRACKS
-- ============================================================

-- Anyone can read published tracks; artists can read their own unpublished
CREATE POLICY "tracks_read_published_or_own"
  ON public.tracks FOR SELECT
  USING (
    status = 'published'
    OR artist_id IN (
      SELECT id FROM public.artists WHERE user_id = auth.uid()
    )
  );

-- Only the artist can insert tracks
CREATE POLICY "tracks_insert_own_artist"
  ON public.tracks FOR INSERT
  WITH CHECK (
    artist_id IN (
      SELECT id FROM public.artists WHERE user_id = auth.uid()
    )
  );

-- Only the artist can update their tracks
CREATE POLICY "tracks_update_own_artist"
  ON public.tracks FOR UPDATE
  USING (
    artist_id IN (
      SELECT id FROM public.artists WHERE user_id = auth.uid()
    )
  );

-- Only the artist can delete their tracks
CREATE POLICY "tracks_delete_own_artist"
  ON public.tracks FOR DELETE
  USING (
    artist_id IN (
      SELECT id FROM public.artists WHERE user_id = auth.uid()
    )
  );


-- ============================================================
-- TRACK FILES
-- Anyone can read (used for streaming URLs)
-- Only service role (backend) can insert/update
-- ============================================================

CREATE POLICY "track_files_read_all"
  ON public.track_files FOR SELECT
  USING (true);

-- Backend only writes track_files (via service role key, bypasses RLS)


-- ============================================================
-- GENRES
-- Public read, admin write (service role handles writes)
-- ============================================================

CREATE POLICY "genres_read_all"
  ON public.genres FOR SELECT
  USING (true);


-- ============================================================
-- TRACK GENRES & TRACK ARTISTS
-- Public read
-- ============================================================

CREATE POLICY "track_genres_read_all"
  ON public.track_genres FOR SELECT
  USING (true);

CREATE POLICY "track_artists_read_all"
  ON public.track_artists FOR SELECT
  USING (true);


-- ============================================================
-- PLAYLISTS
-- ============================================================

-- Read: public playlists are visible to all; private only to owner
CREATE POLICY "playlists_read"
  ON public.playlists FOR SELECT
  USING (
    is_public = true
    OR owner_id = auth.uid()
  );

-- Only logged-in users can create playlists
CREATE POLICY "playlists_insert_own"
  ON public.playlists FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

-- Only owner can update
CREATE POLICY "playlists_update_own"
  ON public.playlists FOR UPDATE
  USING (auth.uid() = owner_id);

-- Only owner can delete
CREATE POLICY "playlists_delete_own"
  ON public.playlists FOR DELETE
  USING (auth.uid() = owner_id);


-- ============================================================
-- PLAYLIST TRACKS
-- ============================================================

-- Anyone who can see the playlist can see its tracks
CREATE POLICY "playlist_tracks_read"
  ON public.playlist_tracks FOR SELECT
  USING (
    playlist_id IN (
      SELECT id FROM public.playlists
      WHERE is_public = true OR owner_id = auth.uid()
    )
  );

-- Owner or collaborators can add tracks
CREATE POLICY "playlist_tracks_insert"
  ON public.playlist_tracks FOR INSERT
  WITH CHECK (
    auth.uid() = added_by
    AND playlist_id IN (
      SELECT id FROM public.playlists
      WHERE owner_id = auth.uid()
      OR is_collaborative = true
    )
  );

-- Owner can delete any track; collaborators can delete tracks they added
CREATE POLICY "playlist_tracks_delete"
  ON public.playlist_tracks FOR DELETE
  USING (
    added_by = auth.uid()
    OR playlist_id IN (
      SELECT id FROM public.playlists WHERE owner_id = auth.uid()
    )
  );


-- ============================================================
-- USER LIBRARY
-- ============================================================

-- Users can only see their own library
CREATE POLICY "library_read_own"
  ON public.user_library FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "library_insert_own"
  ON public.user_library FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "library_delete_own"
  ON public.user_library FOR DELETE
  USING (auth.uid() = user_id);


-- ============================================================
-- USER FOLLOWS
-- ============================================================

-- Anyone can see follows (used for social graph features)
CREATE POLICY "follows_read_all"
  ON public.user_follows FOR SELECT
  USING (true);

-- Users can only create their own follows
CREATE POLICY "follows_insert_own"
  ON public.user_follows FOR INSERT
  WITH CHECK (auth.uid() = follower_id);

-- Users can only unfollow (delete) their own follows
CREATE POLICY "follows_delete_own"
  ON public.user_follows FOR DELETE
  USING (auth.uid() = follower_id);


-- ============================================================
-- LISTENING HISTORY
-- ============================================================

-- Users can only see their own history
CREATE POLICY "history_read_own"
  ON public.listening_history FOR SELECT
  USING (auth.uid() = user_id);

-- Users can only write their own history
CREATE POLICY "history_insert_own"
  ON public.listening_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);


-- ============================================================
-- USER QUEUE
-- ============================================================

CREATE POLICY "queue_read_own"
  ON public.user_queue FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "queue_insert_own"
  ON public.user_queue FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "queue_update_own"
  ON public.user_queue FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "queue_delete_own"
  ON public.user_queue FOR DELETE
  USING (auth.uid() = user_id);


-- ============================================================
-- TRACK LIKES
-- ============================================================

-- Anyone can see how many likes a track has (read all)
CREATE POLICY "likes_read_all"
  ON public.track_likes FOR SELECT
  USING (true);

CREATE POLICY "likes_insert_own"
  ON public.track_likes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "likes_delete_own"
  ON public.track_likes FOR DELETE
  USING (auth.uid() = user_id);


-- ============================================================
-- SUBSCRIPTIONS
-- ============================================================

-- Users can only see their own subscription
CREATE POLICY "subscriptions_read_own"
  ON public.subscriptions FOR SELECT
  USING (auth.uid() = user_id);

-- Backend service role handles subscription writes (via webhooks)


-- ============================================================
-- ROYALTY EVENTS
-- ============================================================

-- Artists can only see their own royalties
CREATE POLICY "royalties_read_own_artist"
  ON public.royalty_events FOR SELECT
  USING (
    artist_id IN (
      SELECT id FROM public.artists WHERE user_id = auth.uid()
    )
  );

-- Only backend service role can write royalty events


-- ============================================================
-- NOTIFICATIONS
-- ============================================================

-- Users can only see their own notifications
CREATE POLICY "notifications_read_own"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

-- Users can mark their own notifications as read
CREATE POLICY "notifications_update_own"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Backend service role handles notification inserts
