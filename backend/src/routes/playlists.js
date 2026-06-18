const express = require("express");
const router = express.Router();
const { requireAuth, optionalAuth } = require("../middleware/auth");
const { validateBody, validateParams, z } = require("../middleware/validation");
const { supabaseAdmin } = require("../utils/supabase");

const playlistCreateSchema = z.object({
  title: z.string().min(1).max(150),
  description: z.string().max(500).optional().nullable(),
  is_public: z.boolean().optional(),
});

const playlistTrackSchema = z.object({
  track_id: z.string().uuid(),
});

const playlistIdParamSchema = z.object({
  id: z.string().uuid(),
});

const playlistTrackParamsSchema = z.object({
  id: z.string().uuid(),
  trackId: z.string().uuid(),
});

// Recount and sync total_tracks for a playlist
const syncPlaylistCount = async (playlistId) => {
  const { count } = await supabaseAdmin
    .from("playlist_tracks")
    .select("id", { count: "exact", head: true })
    .eq("playlist_id", playlistId);

  await supabaseAdmin
    .from("playlists")
    .update({ total_tracks: count || 0 })
    .eq("id", playlistId);
};

// GET /api/playlists/:id
router.get(
  "/:id",
  optionalAuth,
  validateParams(playlistIdParamSchema),
  async (req, res) => {
    const { data, error } = await supabaseAdmin
      .from("playlists")
      .select(
        `
      *,
      users!owner_id ( id, username, display_name, avatar_url ),
      playlist_tracks (
        id, position, added_at,
        tracks (
          id, title, duration_ms, explicit, play_count, cover_art_url,
          artists!tracks_artist_id_fkey ( id, name, avatar_url ),
          albums!tracks_album_id_fkey   ( cover_art_url ),
          track_artists (
            role,
            artists ( id, name, avatar_url )
          )
        )
      )
    `,
      )
      .eq("id", req.params.id)
      .order("position", {
        referencedTable: "playlist_tracks",
        ascending: true,
      })
      .single();

    if (error || !data)
      return res.status(404).json({ error: "Playlist not found" });
    if (!data.is_public && data.owner_id !== req.userId) {
      return res.status(403).json({ error: "This playlist is private" });
    }
    res.json({ data });
  },
);

// POST /api/playlists
router.post(
  "/",
  requireAuth,
  validateBody(playlistCreateSchema),
  async (req, res) => {
    const { title, description, is_public = true } = req.body;
    if (!title?.trim())
      return res.status(400).json({ error: "Title required" });

    const { data, error } = await supabaseAdmin
      .from("playlists")
      .insert({
        owner_id: req.userId,
        title: title.trim(),
        description,
        is_public,
        total_tracks: 0,
      })
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });
    res.status(201).json({ data });
  },
);

// POST /api/playlists/:id/tracks — add track
router.post(
  "/:id/tracks",
  requireAuth,
  validateParams(playlistIdParamSchema),
  validateBody(playlistTrackSchema),
  async (req, res) => {
    const { track_id } = req.body;
    if (!track_id) return res.status(400).json({ error: "track_id required" });

    // Verify playlist belongs to user
    const { data: playlist } = await supabaseAdmin
      .from("playlists")
      .select("id, owner_id")
      .eq("id", req.params.id)
      .single();

    if (!playlist || playlist.owner_id !== req.userId) {
      return res.status(403).json({ error: "Not your playlist" });
    }

    // Check for duplicate
    const { data: existing } = await supabaseAdmin
      .from("playlist_tracks")
      .select("id")
      .eq("playlist_id", req.params.id)
      .eq("track_id", track_id)
      .single();

    if (existing) {
      return res.status(409).json({ error: "Track already in playlist" });
    }

    // Get next position
    const { data: last } = await supabaseAdmin
      .from("playlist_tracks")
      .select("position")
      .eq("playlist_id", req.params.id)
      .order("position", { ascending: false })
      .limit(1)
      .single();

    const position = (last?.position ?? -1) + 1;

    const { data, error } = await supabaseAdmin
      .from("playlist_tracks")
      .insert({
        playlist_id: req.params.id,
        track_id,
        added_by: req.userId,
        position,
      })
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });

    // Sync count accurately
    await syncPlaylistCount(req.params.id);

    res.status(201).json({ data });
  },
);

// DELETE /api/playlists/:id/tracks/:trackId — remove track
router.delete(
  "/:id/tracks/:trackId",
  requireAuth,
  validateParams(playlistTrackParamsSchema),
  async (req, res) => {
    // Verify playlist belongs to user
    const { data: playlist } = await supabaseAdmin
      .from("playlists")
      .select("id, owner_id")
      .eq("id", req.params.id)
      .single();

    if (!playlist || playlist.owner_id !== req.userId) {
      return res.status(403).json({ error: "Not your playlist" });
    }

    const { error } = await supabaseAdmin
      .from("playlist_tracks")
      .delete()
      .eq("playlist_id", req.params.id)
      .eq("track_id", req.params.trackId);

    if (error) return res.status(400).json({ error: error.message });

    // Sync count accurately
    await syncPlaylistCount(req.params.id);

    res.json({ success: true });
  },
);

module.exports = router;
