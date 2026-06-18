-- ============================================================
-- SOUNDWAVE - Role-aware RLS for creator-owned content
-- Backend service-role requests still bypass RLS, but direct client
-- writes now require creator/admin role plus ownership.
-- ============================================================

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT AS $$
  SELECT COALESCE(
    (SELECT role FROM public.users WHERE id = auth.uid() AND account_status = 'active'),
    'listener'
  );
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

DROP POLICY IF EXISTS "artists_insert_own" ON public.artists;
CREATE POLICY "artists_insert_creator_own"
  ON public.artists FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND public.current_user_role() IN ('creator', 'admin')
  );

DROP POLICY IF EXISTS "artists_update_own" ON public.artists;
CREATE POLICY "artists_update_creator_own"
  ON public.artists FOR UPDATE
  USING (
    public.current_user_role() = 'admin'
    OR (
      auth.uid() = user_id
      AND public.current_user_role() = 'creator'
    )
  )
  WITH CHECK (
    public.current_user_role() = 'admin'
    OR (
      auth.uid() = user_id
      AND public.current_user_role() = 'creator'
    )
  );

DROP POLICY IF EXISTS "albums_insert_own_artist" ON public.albums;
CREATE POLICY "albums_insert_creator_own_artist"
  ON public.albums FOR INSERT
  WITH CHECK (
    public.current_user_role() IN ('creator', 'admin')
    AND artist_id IN (
      SELECT id FROM public.artists WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "albums_update_own_artist" ON public.albums;
CREATE POLICY "albums_update_creator_own_artist"
  ON public.albums FOR UPDATE
  USING (
    public.current_user_role() = 'admin'
    OR (
      public.current_user_role() = 'creator'
      AND artist_id IN (
        SELECT id FROM public.artists WHERE user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    public.current_user_role() = 'admin'
    OR (
      public.current_user_role() = 'creator'
      AND artist_id IN (
        SELECT id FROM public.artists WHERE user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "tracks_insert_own_artist" ON public.tracks;
CREATE POLICY "tracks_insert_creator_own_artist"
  ON public.tracks FOR INSERT
  WITH CHECK (
    public.current_user_role() IN ('creator', 'admin')
    AND artist_id IN (
      SELECT id FROM public.artists WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "tracks_update_own_artist" ON public.tracks;
CREATE POLICY "tracks_update_creator_own_artist"
  ON public.tracks FOR UPDATE
  USING (
    public.current_user_role() = 'admin'
    OR (
      public.current_user_role() = 'creator'
      AND artist_id IN (
        SELECT id FROM public.artists WHERE user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    public.current_user_role() = 'admin'
    OR (
      public.current_user_role() = 'creator'
      AND artist_id IN (
        SELECT id FROM public.artists WHERE user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "tracks_delete_own_artist" ON public.tracks;
CREATE POLICY "tracks_delete_creator_own_artist"
  ON public.tracks FOR DELETE
  USING (
    public.current_user_role() = 'admin'
    OR (
      public.current_user_role() = 'creator'
      AND artist_id IN (
        SELECT id FROM public.artists WHERE user_id = auth.uid()
      )
    )
  );

NOTIFY pgrst, 'reload schema';
